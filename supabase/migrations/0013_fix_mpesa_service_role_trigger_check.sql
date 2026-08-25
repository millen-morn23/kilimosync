-- ─────────────────────────────────────────────────────────────────────────
-- Fixes a live bug found during the first real Daraja sandbox test:
-- record_stk_initiation()/confirm_mpesa_payment()/fail_mpesa_payment()
-- (0006_mpesa.sql, redefined in 0008_orders_lifecycle.sql) each end with a
-- plain `update public.orders set payment_status = ...`, which fires the
-- `orders_guard_farmer_update` trigger (guard_order_status_update(),
-- 0008_orders_lifecycle.sql). That function's service-role bypass checked
-- `session_user = 'service_role'` — but Supabase/PostgREST connects
-- through a shared pooled role and issues a per-request `SET ROLE
-- service_role`, which changes `current_user`, not `session_user` (that
-- stays whatever role the pooled connection itself authenticated as).
-- session_user therefore never equals 'service_role' for a real
-- PostgREST-issued RPC call, so the bypass never fired: execution fell
-- through to is_admin()/is_farmer_of_order() (both false — no end-user
-- session exists on a service-role call), and the trigger raised "Not
-- authorized to update this order", rolling back the M-PESA function's
-- whole transaction. Confirmed live: a real STK push reached the test
-- phone and Daraja accepted it, but the app showed "Could not start
-- payment for this order" and `payments` stayed empty with the order
-- stuck at payment_status = 'PENDING'.
--
-- Fix: check `current_user` instead — that's what actually reflects
-- PostgREST's per-request role switch. Only this one condition changes;
-- every other check and transition rule in the function is unchanged.
-- ─────────────────────────────────────────────────────────────────────────

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
  -- to them. current_user reflects PostgREST's per-request `SET ROLE`
  -- (session_user does not — it stays whatever role the pooled
  -- connection itself authenticated as, e.g. `authenticator`, and never
  -- changes), so current_user is what actually identifies the caller's
  -- effective role here.
  if current_user = 'service_role' then
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
