-- ─────────────────────────────────────────────────────────────────────────
-- Phase 5.5 follow-up #2 — dispute hardening found in a code/architecture
-- audit (0011 already covered notification links + oversold disputes):
--
-- 1. disputes_insert_own_order only checked the order belonged to the
--    caller — a buyer could open a dispute on an unpaid/cancelled order,
--    since only the UI (payment_status === 'PAID') hid the form. Now
--    enforced in the RLS WITH CHECK itself.
-- 2. No guard against opening a second dispute on an order that already
--    has one open/investigating — a double-submit silently created a
--    second row the buyer's order page couldn't show (only the latest is
--    fetched). A partial unique index now rejects that at the DB level.
-- 3. resolveDispute() let an admin close a dispute with an empty response
--    (the UI marked it "optional"). A trigger now requires a non-empty
--    admin_response whenever status moves to resolved/rejected, as a
--    backstop under the app-layer validation added alongside this
--    migration.
-- ─────────────────────────────────────────────────────────────────────────

alter policy "disputes_insert_own_order" on public.disputes
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.buyer_id = auth.uid()
        and o.payment_status = 'PAID'
    )
  );

create unique index disputes_one_active_per_order
  on public.disputes(order_id)
  where status in ('open', 'investigating');

create or replace function public.guard_dispute_resolution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('resolved', 'rejected')
    and (new.admin_response is null or btrim(new.admin_response) = '')
  then
    raise exception 'admin_response is required when resolving or rejecting a dispute';
  end if;
  return new;
end;
$$;

create trigger disputes_guard_resolution
  before update on public.disputes
  for each row execute function public.guard_dispute_resolution();

-- confirm_mpesa_payment() (0011) inserts an oversold dispute unconditionally;
-- the new disputes_one_active_per_order index above means that insert must
-- now tolerate an order that already has an open/investigating dispute
-- (e.g. a buyer-opened one) without raising — a payment confirmation must
-- never fail because of unrelated dispute bookkeeping. Re-declared in full
-- since CREATE OR REPLACE FUNCTION requires the whole body; only the
-- disputes insert gained an ON CONFLICT clause.
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
  v_farmer_id uuid;
  v_low_stock_threshold constant numeric := 5;
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

  insert into public.notifications (user_id, type, title, message, data)
  values (
    v_payment.buyer_id,
    'payment_successful',
    'Payment successful',
    'Your M-PESA payment of KES ' || v_payment.amount || ' was received.',
    jsonb_build_object('order_id', v_payment.order_id)
  );

  for v_item in
    select product_id, quantity from public.order_items where order_id = v_payment.order_id
  loop
    if v_item.product_id is not null then
      if not public.deduct_product_inventory(v_item.product_id, v_item.quantity) then
        v_all_ok := false;
      else
        perform 1 from public.products
        where id = v_item.product_id and quantity_available <= v_low_stock_threshold;
        if found then
          insert into public.notifications (user_id, type, title, message, data)
          select
            fp.user_id,
            'low_stock',
            'Low stock alert',
            p.name || ' is down to ' || p.quantity_available || ' ' || p.quantity_unit || '.',
            jsonb_build_object('product_id', p.id)
          from public.products p
          join public.farmer_profiles fp on fp.id = p.farmer_id
          where p.id = v_item.product_id;
        end if;
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
    -- Surface this as a real dispute (authored by the affected buyer, since
    -- public.disputes.user_id is not-null) so it goes through the same
    -- investigating/resolved/rejected admin lifecycle as a buyer-opened
    -- one, instead of only existing as an audit-log row + notification.
    -- ON CONFLICT: don't fail payment confirmation just because this order
    -- already has an open/investigating dispute (disputes_one_active_per_order).
    insert into public.disputes (order_id, user_id, reason, description)
    values (
      v_payment.order_id,
      v_payment.buyer_id,
      'inventory_oversold',
      'Automatically flagged by KilimoSync: payment was confirmed but there was insufficient stock for one or more items in this order.'
    )
    on conflict (order_id) where status in ('open', 'investigating') do nothing;
    insert into public.notifications (user_id, type, title, message, data)
    select id, 'dispute_opened', 'Order flagged: oversold at payment',
      'Order ' || v_payment.order_id || ' was paid but had insufficient stock for one or more items.',
      jsonb_build_object('order_id', v_payment.order_id)
    from public.users where role = 'admin';
  end if;

  for v_farmer_id in
    select distinct farmer_id from public.order_items where order_id = v_payment.order_id
  loop
    insert into public.notifications (user_id, type, title, message, data)
    select fp.user_id, 'new_order', 'New order received',
      'You have a new paid order to prepare.',
      jsonb_build_object('order_id', v_payment.order_id)
    from public.farmer_profiles fp where fp.id = v_farmer_id;
  end loop;

  return 'confirmed';
end;
$$;
