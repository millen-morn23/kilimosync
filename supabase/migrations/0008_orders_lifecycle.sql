-- ─────────────────────────────────────────────────────────────────────────
-- Phase 5 — order status progression + notifications
--
-- Two things land together here because the second depends on the first:
-- letting a farmer move their own orders forward (CONFIRMED → PREPARING →
-- READY_FOR_DELIVERY), and firing a real buyer notification on every
-- order_status change regardless of which code path caused it (the
-- M-PESA callback functions, a farmer, or an admin all just run a plain
-- UPDATE — the trigger below is what makes every one of those notify).
-- ─────────────────────────────────────────────────────────────────────────

-- Lets a farmer update order_status (only) on an order containing their
-- product, alongside the existing admin-only policy — Postgres ORs
-- multiple permissive USING policies for the same command together.
create policy "orders_update_farmer_of_order" on public.orders
  for update using (public.is_farmer_of_order(id));

-- Enforces what a farmer-scoped update is actually allowed to do, since
-- the USING clause above only controls which *rows* are reachable, not
-- which *columns* or *transitions*. Admins are unrestricted (they may
-- need to correct any field). Everyone else who somehow reaches this
-- trigger (shouldn't happen — RLS already filtered to farmer-of-order or
-- admin) is rejected outright.
create or replace function public.guard_order_status_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The M-PESA callback functions (0006_mpesa.sql) run as service_role
  -- and issue plain UPDATEs on this table as part of their own,
  -- already-gated logic (REVOKE/GRANT EXECUTE restricts who can call
  -- them at all) — this trigger's farmer/admin restriction doesn't apply
  -- to them. session_user (unlike current_user) isn't swapped to the
  -- function owner by SECURITY DEFINER, so this correctly identifies the
  -- actual connecting role even from inside this trigger.
  if session_user = 'service_role' then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if not public.is_farmer_of_order(old.id) then
    raise exception 'Not authorized to update this order';
  end if;

  if new.buyer_id is distinct from old.buyer_id
    or new.subtotal is distinct from old.subtotal
    or new.delivery_fee is distinct from old.delivery_fee
    or new.platform_fee is distinct from old.platform_fee
    or new.total_amount is distinct from old.total_amount
    or new.payment_status is distinct from old.payment_status
    or new.delivery_county is distinct from old.delivery_county
    or new.delivery_address is distinct from old.delivery_address
    or new.delivery_notes is distinct from old.delivery_notes
    or new.buyer_name is distinct from old.buyer_name
    or new.buyer_phone is distinct from old.buyer_phone
  then
    raise exception 'Farmers may only update order_status';
  end if;

  if not (
    (old.order_status = 'CONFIRMED' and new.order_status = 'PREPARING')
    or (old.order_status = 'PREPARING' and new.order_status = 'READY_FOR_DELIVERY')
    or (old.order_status = new.order_status)
  ) then
    raise exception 'Invalid order status transition for a farmer: % -> %', old.order_status, new.order_status;
  end if;

  return new;
end;
$$;

create trigger orders_guard_farmer_update
  before update on public.orders
  for each row execute function public.guard_order_status_update();

-- Fires a buyer notification on every order_status change, regardless of
-- which code path caused it — this is what makes confirm_mpesa_payment(),
-- the farmer-facing "advance status" action, and the admin delivery UI
-- all notify correctly without each one having to remember to.
create or replace function public.notify_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type public.notification_type;
  v_title text;
  v_message text;
begin
  if new.order_status = old.order_status then
    return new;
  end if;

  case new.order_status
    when 'CONFIRMED' then
      v_type := 'order_confirmed';
      v_title := 'Order confirmed';
      v_message := 'Your order has been confirmed and the farmer has been notified.';
    when 'PREPARING' then
      v_type := 'order_preparing';
      v_title := 'Order being prepared';
      v_message := 'The farmer is preparing your order.';
    when 'READY_FOR_DELIVERY' then
      v_type := 'order_ready';
      v_title := 'Order ready';
      v_message := 'Your order is ready and awaiting delivery.';
    when 'OUT_FOR_DELIVERY' then
      v_type := 'order_out_for_delivery';
      v_title := 'Order out for delivery';
      v_message := 'Your order is on its way.';
    when 'DELIVERED' then
      v_type := 'order_delivered';
      v_title := 'Order delivered';
      v_message := 'Your order has been delivered. Enjoy!';
    when 'DISPUTED' then
      v_type := 'system_warning';
      v_title := 'Order needs attention';
      v_message := 'We could not confirm enough stock for part of your order. Our team will contact you shortly — you will not lose your payment.';
    else
      return new;
  end case;

  insert into public.notifications (user_id, type, title, message)
  values (new.buyer_id, v_type, v_title, v_message);

  return new;
end;
$$;

create trigger orders_notify_status_change
  after update on public.orders
  for each row execute function public.notify_order_status_change();

-- ─────────────────────────────────────────────────────────────────────────
-- Extend the M-PESA payment functions (0006_mpesa.sql) with the
-- notifications docs/M-PESA.md and the product brief specify: buyer
-- payment result, farmer new-order alert, and a low-stock nudge when a
-- confirmed sale drops a product to its last few units. The order-status
-- side (CONFIRMED, DISPUTED) is already covered by the trigger above,
-- since these functions just run a plain UPDATE on orders.
-- ─────────────────────────────────────────────────────────────────────────

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

  insert into public.notifications (user_id, type, title, message)
  values (
    v_payment.buyer_id,
    'payment_successful',
    'Payment successful',
    'Your M-PESA payment of KES ' || v_payment.amount || ' was received.'
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
          insert into public.notifications (user_id, type, title, message)
          select
            fp.user_id,
            'low_stock',
            'Low stock alert',
            p.name || ' is down to ' || p.quantity_available || ' ' || p.quantity_unit || '.'
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
    insert into public.notifications (user_id, type, title, message)
    select id, 'dispute_opened', 'Order flagged: oversold at payment',
      'Order ' || v_payment.order_id || ' was paid but had insufficient stock for one or more items.'
    from public.users where role = 'admin';
  end if;

  for v_farmer_id in
    select distinct farmer_id from public.order_items where order_id = v_payment.order_id
  loop
    insert into public.notifications (user_id, type, title, message)
    select fp.user_id, 'new_order', 'New order received',
      'You have a new paid order to prepare.'
    from public.farmer_profiles fp where fp.id = v_farmer_id;
  end loop;

  return 'confirmed';
end;
$$;

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

  insert into public.notifications (user_id, type, title, message)
  values (
    v_payment.buyer_id,
    'payment_failed',
    'Payment not completed',
    'Your M-PESA payment could not be completed. You can try again from your order.'
  );

  return 'recorded';
end;
$$;
