-- ─────────────────────────────────────────────────────────────────────────
-- Follow-up to 0013_fix_mpesa_service_role_trigger_check.sql, which did
-- NOT actually fix the bug — confirmed by a live behavioral test after
-- 0013 was applied: record_stk_initiation() still failed with "Not
-- authorized to update this order".
--
-- Why 0013's `current_user = 'service_role'` check still failed:
-- record_stk_initiation() (0006_mpesa.sql) is itself `security definer`,
-- and guard_order_status_update() (the trigger it fires via its own
-- `update public.orders ...`) is *also* `security definer`. Postgres
-- swaps `current_user`/`current_role` to the function OWNER at every
-- `security definer` boundary — so by the time execution reaches inside
-- guard_order_status_update(), two `security definer` layers deep from
-- the original service-role RPC call, `current_user` reflects that
-- trigger function's owner (the migration-running role), not
-- `service_role`. Same failure mode as `session_user` (0008's original
-- check), via a different mechanism.
--
-- Fix: use Supabase's own `auth.role()` helper instead of any Postgres
-- role-identity primitive. `auth.role()` reads a per-request GUC
-- (`request.jwt.claim.role`, set once by PostgREST per request) rather
-- than checking "current effective role" — GUCs are transaction/session
-- config, untouched by `security definer`'s role-swapping, so this is
-- stable no matter how many `security definer` functions are nested.
-- This is also already the established pattern in this project:
-- `0002_rls.sql`'s `platform_settings_select_authenticated` policy uses
-- `auth.role() = 'authenticated'` the same way.
--
-- Only this one condition changes. Every other check and transition rule
-- — is_admin(), is_farmer_of_order(), the farmer column-lock, the farmer
-- status-transition whitelist — is untouched, so ordinary authenticated
-- users, farmers, and anonymous callers are exactly as restricted as
-- before.
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
  -- to them. auth.role() reads PostgREST's per-request JWT-role GUC, so
  -- unlike current_user/session_user it stays correct regardless of how
  -- many nested security definer calls sit between the original RPC
  -- call and this trigger.
  if auth.role() = 'service_role' then
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
