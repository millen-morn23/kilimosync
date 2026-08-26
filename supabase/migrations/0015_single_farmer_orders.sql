-- ─────────────────────────────────────────────────────────────────────────
-- Phase A of the delivery-partner architecture — single-farmer-per-order.
--
-- Today nothing stops a cart (and therefore an order) from holding
-- products from more than one farmer, but the rest of the system already
-- assumes one order has one pickup point (one `deliveries` row, one
-- `pickup_location`). This migration makes "one order = one farmer" a
-- fact enforced by Postgres, not an assumption the app happens to keep:
--
--   1. orders.farmer_id becomes the authoritative farmer relationship for
--      an order — set once, at checkout, from the (now-validated)
--      single-farmer cart. It is not a convenience mirror of
--      order_items.farmer_id; order_items are checked AGAINST it.
--   2. Backfilled for existing orders from their own order_items (safe:
--      every order placed so far was, in practice, already single-farmer —
--      confirmed via the read-only pre-flight check, orphan count = 0).
--      The backfill UPDATE fires the existing orders_guard_farmer_update
--      trigger (0008) on every row. That trigger's identity checks
--      (auth.role() = 'service_role', is_admin(), is_farmer_of_order())
--      all read PostgREST-request-scoped GUCs (request.jwt.claim.role,
--      auth.uid()) that are only ever set when a request actually passes
--      through PostgREST. A migration applied directly against Postgres
--      (the Supabase SQL Editor, `supabase db push`, psql) is not such a
--      request, so every one of those checks correctly evaluates to "not
--      authorized" and the trigger raises — not a bug in the trigger, and
--      not something this migration should route around by touching
--      guard_order_status_update() itself. The backfill instead disables
--      only that one named trigger for the duration of this single
--      UPDATE, then re-enables it immediately after — the same pattern
--      docs/SECURITY.md already documents for bootstrapping the first
--      admin account, applied here to the same underlying situation: a
--      legitimate one-off administrative write that the guard trigger,
--      correctly, has no way to recognize as authorized. The ALTER TABLE
--      that disables it takes an ACCESS EXCLUSIVE lock, so no concurrent
--      session can write to orders unguarded during the brief window it
--      is off.
--   3. guard_order_status_update() (0008, last touched in 0014) is
--      re-declared with exactly one additive clause: farmer_id joins the
--      list of columns a farmer may never change via their own
--      order-status update. The auth.role() = 'service_role' bypass and
--      the farmer transition whitelist are otherwise byte-for-byte
--      unchanged from 0014 — the M-PESA functions' own UPDATEs on this
--      table are unaffected.
--   4. A new BEFORE INSERT trigger on order_items is the database-level
--      defense-in-depth backstop: even a direct insert that bypasses the
--      application entirely cannot create an order_items row whose
--      farmer_id disagrees with its parent order's farmer_id.
--
-- No previously-merged migration (0001-0014) is edited by this file.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. The authoritative column.
alter table public.orders
  add column farmer_id uuid references public.farmer_profiles(id);

create index orders_farmer_idx on public.orders(farmer_id);

-- 2. Backfill from each order's own order_items. Every order placed
-- before this migration was, in practice, single-farmer (the gap was
-- latent, never exercised by the UI), so the first order_item's
-- farmer_id is authoritative for the backfill.
--
-- orders_guard_farmer_update (0008) is disabled only for this one
-- statement — see the header comment above for why it must be, and why
-- that is safe. guard_order_status_update() itself is never modified for
-- this purpose, and no other trigger on this table is touched.
alter table public.orders disable trigger orders_guard_farmer_update;

update public.orders o
set farmer_id = (
  select oi.farmer_id
  from public.order_items oi
  where oi.order_id = o.id
  order by oi.created_at
  limit 1
)
where farmer_id is null;

alter table public.orders enable trigger orders_guard_farmer_update;

-- 3. Lock it down. This is intentionally unconditional: if any order has
-- no order_items to backfill from, this fails loudly here rather than
-- silently leaving a nullable gap for later code to trip over. (Verified
-- via a read-only pre-flight check against the live project: 0 such
-- orders exist at the time this migration was written.)
alter table public.orders
  alter column farmer_id set not null;

-- 4. Re-declare guard_order_status_update() in full — CREATE OR REPLACE
-- requires the whole body, same convention already used in 0011/0012 when
-- extending confirm_mpesa_payment(). Only one line is new (marked below);
-- the service_role bypass, the admin bypass, the farmer column-lock list,
-- and the farmer transition whitelist are otherwise identical to 0014.
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
  -- call and this trigger. Unchanged from 0014.
  if auth.role() = 'service_role' then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if not public.is_farmer_of_order(old.id) then
    raise exception 'Not authorized to update this order';
  end if;

  if new.farmer_id is distinct from old.farmer_id                 -- new: orders.farmer_id is authoritative and immutable to a farmer's own status-update path
    or new.buyer_id is distinct from old.buyer_id
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

-- 5. Defense-in-depth: validate each new order_items row against its
-- parent order's authoritative farmer_id. This is a peer-to-authority
-- check (order_items must agree with orders.farmer_id), not a
-- peer-to-peer check among sibling order_items rows — consistent with
-- farmer_id being authoritative on orders, not derived from order_items.
-- security definer for the same reason every other guard trigger in this
-- schema is (guard_order_status_update, guard_farmer_verification_update,
-- deduct_product_inventory): it must behave identically regardless of
-- which client performs the insert.
--
-- BEFORE INSERT only: order_items are write-once snapshots (see
-- 0001_init.sql's header comment on that table) — nothing in the app
-- ever updates them, so there is no UPDATE path to guard here today.
create or replace function public.enforce_order_item_farmer_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_farmer_id uuid;
begin
  select farmer_id into v_order_farmer_id from public.orders where id = new.order_id;

  if new.farmer_id is distinct from v_order_farmer_id then
    raise exception 'order_items.farmer_id must match orders.farmer_id (single-farmer-per-order)';
  end if;

  return new;
end;
$$;

create trigger order_items_guard_single_farmer
  before insert on public.order_items
  for each row execute function public.enforce_order_item_farmer_consistency();
