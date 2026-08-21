-- ─────────────────────────────────────────────────────────────────────────
-- M-PESA payment writes (Phase 3)
--
-- Payments are, by design (see supabase/migrations/0002_rls.sql), written
-- exclusively by the server-side M-PESA integration using the
-- service-role client — no RLS INSERT/UPDATE policy exists for buyers on
-- `payments`, and `orders_update_admin_only` blocks a buyer-scoped client
-- from touching `orders.payment_status` too. These functions are the only
-- way `payments`/`orders` money-lifecycle columns move, and each one runs
-- as a single atomic transaction so a network blip mid-write can never
-- leave an order and its payment row disagreeing about status.
-- ─────────────────────────────────────────────────────────────────────────

-- Records that an STK push was accepted by Daraja and moves the order to
-- STK_SENT. Locks the order row first so two rapid "Pay with M-PESA"
-- clicks on the same order can't both succeed — the second sees the
-- STK_SENT status written by the first and is rejected (returns null).
create or replace function public.record_stk_initiation(
  p_order_id uuid,
  p_buyer_id uuid,
  p_amount numeric,
  p_phone text,
  p_merchant_request_id text,
  p_checkout_request_id text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_current_status public.payment_status;
begin
  select payment_status into v_current_status
  from public.orders
  where id = p_order_id and buyer_id = p_buyer_id
  for update;

  if not found or v_current_status in ('STK_SENT', 'PROCESSING', 'PAID') then
    return null;
  end if;

  insert into public.payments (
    order_id, buyer_id, amount, phone_number, status,
    merchant_request_id, checkout_request_id
  )
  values (
    p_order_id, p_buyer_id, p_amount, p_phone, 'STK_SENT',
    p_merchant_request_id, p_checkout_request_id
  )
  returning id into v_payment_id;

  update public.orders set payment_status = 'STK_SENT' where id = p_order_id;

  return v_payment_id;
end;
$$;

revoke execute on function public.record_stk_initiation(uuid, uuid, numeric, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_stk_initiation(uuid, uuid, numeric, text, text, text)
  to service_role;

-- Applies a successful ('ResultCode: 0') Daraja callback. Idempotent: a
-- payment already in a terminal state (PAID/FAILED/CANCELLED/TIMEOUT) is
-- left untouched and 'already_processed' is returned, so a duplicate
-- callback from Safaricom's retry behavior can never double-charge
-- inventory or double-fire notifications. Deducts inventory for every
-- order line inside the same transaction as the status update; if any
-- line is oversold (see docs/ARCHITECTURE.md §Inventory concurrency) the
-- order is marked DISPUTED instead of CONFIRMED and an audit log is left
-- for manual admin reconciliation — the payment itself is never reversed
-- or dropped, since Safaricom has already moved real money.
create or replace function public.confirm_mpesa_payment(
  p_checkout_request_id text,
  p_receipt text,
  p_result_code integer,
  p_result_desc text,
  p_raw jsonb
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_item record;
  v_all_ok boolean := true;
begin
  select * into v_payment from public.payments
  where checkout_request_id = p_checkout_request_id
  for update;

  if not found then
    return 'unknown_checkout_request_id';
  end if;

  if v_payment.status in ('PAID', 'FAILED', 'CANCELLED', 'TIMEOUT') then
    return 'already_processed';
  end if;

  update public.payments
  set status = 'PAID',
      mpesa_receipt_number = p_receipt,
      result_code = p_result_code,
      result_description = p_result_desc,
      raw_callback = p_raw,
      completed_at = now()
  where id = v_payment.id;

  update public.orders set payment_status = 'PAID' where id = v_payment.order_id;

  for v_item in
    select product_id, quantity from public.order_items where order_id = v_payment.order_id
  loop
    if v_item.product_id is not null then
      if not public.deduct_product_inventory(v_item.product_id, v_item.quantity) then
        v_all_ok := false;
      end if;
    end if;
  end loop;

  if v_all_ok then
    update public.orders set order_status = 'CONFIRMED' where id = v_payment.order_id;
  else
    update public.orders set order_status = 'DISPUTED' where id = v_payment.order_id;
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      null,
      'payment_confirmed_inventory_oversold',
      'orders',
      v_payment.order_id,
      jsonb_build_object('payment_id', v_payment.id, 'checkout_request_id', p_checkout_request_id)
    );
  end if;

  return 'confirmed';
end;
$$;

revoke execute on function public.confirm_mpesa_payment(text, text, integer, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.confirm_mpesa_payment(text, text, integer, text, jsonb)
  to service_role;

-- Applies a non-zero ResultCode callback (cancelled, insufficient funds,
-- timeout, wrong PIN, etc). Same idempotency guarantee as the success
-- path. Leaves order_status at PENDING_PAYMENT and inventory untouched —
-- the buyer can retry payment on the same order.
create or replace function public.fail_mpesa_payment(
  p_checkout_request_id text,
  p_status public.payment_status,
  p_result_code integer,
  p_result_desc text,
  p_raw jsonb
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
begin
  select * into v_payment from public.payments
  where checkout_request_id = p_checkout_request_id
  for update;

  if not found then
    return 'unknown_checkout_request_id';
  end if;

  if v_payment.status in ('PAID', 'FAILED', 'CANCELLED', 'TIMEOUT') then
    return 'already_processed';
  end if;

  update public.payments
  set status = p_status,
      result_code = p_result_code,
      result_description = p_result_desc,
      raw_callback = p_raw,
      completed_at = now()
  where id = v_payment.id;

  update public.orders set payment_status = p_status where id = v_payment.order_id;

  return 'recorded';
end;
$$;

revoke execute on function public.fail_mpesa_payment(text, public.payment_status, integer, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.fail_mpesa_payment(text, public.payment_status, integer, text, jsonb)
  to service_role;
