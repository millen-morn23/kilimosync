-- ─────────────────────────────────────────────────────────────────────────
-- Phase 5.5 follow-up — two gaps found in a code/architecture audit:
--
-- 1. public.notifications.data has sat unused since 0001_init.sql; every
--    insert wrote '{}', so the app had no way to link a notification back
--    to the order/dispute/product it was about. This migration populates
--    `data` on every DB-side notification insert (order_id / dispute_id /
--    product_id as relevant) — application-code inserts are updated to
--    match in the same change.
--
-- 2. confirm_mpesa_payment() flags an order DISPUTED when it finds
--    insufficient stock after payment, but never wrote a row to
--    public.disputes — so that whole class of system-flagged dispute was
--    invisible to /admin/disputes and never went through the normal
--    investigating/resolved/rejected lifecycle. It now opens a real
--    dispute row, authored by the affected buyer, alongside the existing
--    admin notification.
-- ─────────────────────────────────────────────────────────────────────────

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

  insert into public.notifications (user_id, type, title, message, data)
  values (new.buyer_id, v_type, v_title, v_message, jsonb_build_object('order_id', new.id));

  return new;
end;
$$;

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
    insert into public.disputes (order_id, user_id, reason, description)
    values (
      v_payment.order_id,
      v_payment.buyer_id,
      'inventory_oversold',
      'Automatically flagged by KilimoSync: payment was confirmed but there was insufficient stock for one or more items in this order.'
    );
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

  insert into public.notifications (user_id, type, title, message, data)
  values (
    v_payment.buyer_id,
    'payment_failed',
    'Payment not completed',
    'Your M-PESA payment could not be completed. You can try again from your order.',
    jsonb_build_object('order_id', v_payment.order_id)
  );

  return 'recorded';
end;
$$;
