-- ─────────────────────────────────────────────────────────────────────────
-- Phase E (delivery tracking) — checkpoints E-1 and E-2, one migration.
-- E-1 (schema): two nullable timestamp columns and one additive change to
-- the existing delivery guard trigger. E-2 (notification): one new
-- function + one new AFTER UPDATE trigger, reusing E-1's own timestamp as
-- its firing signal. No RLS policy, no new table, no enum change in
-- either checkpoint.
--
-- deliveries already carries assigned_at/picked_up_at/delivered_at
-- (0001_init.sql), each meaning "the moment this delivery first reached
-- this stage." This migration adds the two missing stages to that same
-- vocabulary — in_transit_at and failed_at — so a future timeline view
-- (E-3/E-4) can render the complete lifecycle from stored data alone,
-- with no new table.
--
-- Why in_transit_at needs an actual guarantee, not just a convention:
-- unlike assigned_at/picked_up_at/delivered_at, IN_TRANSIT is reachable
-- from three different write paths — a delivery partner's own advance
-- (advanceDeliveryStatus(), src/lib/actions/delivery-partner.ts), an
-- admin's ordinary unclaimed-delivery fallback, and an admin's explicit
-- override (both syncDeliveryIfUnclaimed()/adminOverrideDeliveryStatus(),
-- src/lib/actions/orders.ts, Phase D checkpoint D1). Whichever of those
-- three reaches IN_TRANSIT first must win, and none of the other two —
-- including a later admin override — may overwrite that original value.
-- failed_at only has one realistic write path today (markDeliveryFailed()
-- only ever starts from ASSIGNED/PICKED_UP/IN_TRANSIT, never from FAILED
-- itself), but gets the identical protection for consistency, at
-- effectively zero extra cost.
--
-- The correct home for a "first time only, no matter which caller"
-- invariant is the trigger that already governs every write to this
-- table, not three independent application-code checks (one of which
-- would need to duplicate it inside src/lib/actions/delivery-partner.ts,
-- deliberately left untouched since Phase C shipped). Application code
-- already sends `status: 'IN_TRANSIT'`/`'FAILED'` from every one of those
-- three paths without any changes needed here — the trigger below stamps
-- the timestamp on their behalf, invisibly, the first time only.
--
-- The one gap a purely trigger-side fix can't close: guard_delivery_
-- status_update() only fires BEFORE UPDATE, never BEFORE INSERT.
-- syncDeliveryIfUnclaimed()'s legacy admin-fallback branch (no existing
-- deliveries row for this order) INSERTs a fresh row directly at
-- status = 'IN_TRANSIT' or 'DELIVERED' — that INSERT never passes through
-- this trigger at all, so it needs its own explicit in_transit_at in the
-- application code (src/lib/actions/orders.ts, this same checkpoint) —
-- the one case where setting it directly is correct, since a fresh INSERT
-- can never "overwrite" a prior value by definition. No INSERT path in
-- this codebase ever creates a fresh row directly at FAILED, so
-- failed_at needs no equivalent INSERT-side change.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.deliveries
  add column in_transit_at timestamptz,
  add column failed_at timestamptz;

-- Re-declared in full — CREATE OR REPLACE requires the whole body, the
-- same convention 0015_single_farmer_orders.sql already used when it
-- added exactly one additive clause to guard_order_status_update(). Every
-- existing branch below the two new statements — the service_role/admin
-- bypasses, the column lock, the claim logic, the ownership check, the
-- release logic, the transition whitelist — is byte-for-byte unchanged
-- from 0018_delivery_assignment.sql. The trigger declaration itself
-- (deliveries_guard_status_update, before update on public.deliveries)
-- is not re-created — CREATE OR REPLACE FUNCTION is enough for it to pick
-- up this new body automatically.
create or replace function public.guard_delivery_status_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Phase E, checkpoint E-1: stamp the first arrival at IN_TRANSIT/FAILED,
  -- once, regardless of which of the branches below (service_role, admin,
  -- or the ordinary partner path) ends up accepting this write. Placed
  -- before every other check so it applies uniformly to all of them —
  -- an admin override reaching IN_TRANSIT for the first time gets the
  -- same stamp a partner's own advance would have gotten; a repeat write
  -- (old value already set) leaves it untouched either way.
  if new.status = 'IN_TRANSIT' and old.in_transit_at is null then
    new.in_transit_at := now();
  end if;

  if new.status = 'FAILED' and old.failed_at is null then
    new.failed_at := now();
  end if;

  if auth.role() = 'service_role' then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  -- Column lock, applies regardless of which transition shape follows:
  -- a delivery partner may never change which order this row belongs to,
  -- where the pickup/delivery is, or what the fee is — only assignment
  -- (transporter_id, governed below) and status/timestamps.
  if new.order_id is distinct from old.order_id
    or new.pickup_location is distinct from old.pickup_location
    or new.delivery_location is distinct from old.delivery_location
    or new.delivery_fee is distinct from old.delivery_fee
  then
    raise exception 'Delivery partners may only update assignment and status, not delivery details';
  end if;

  -- Claim: an eligible partner takes an unassigned job. Re-derives
  -- eligibility independently of the RLS policy that already filtered
  -- this row — see the header comment above for why.
  if old.transporter_id is null
    and old.status = 'UNASSIGNED'
    and new.transporter_id = auth.uid()
    and new.status = 'ASSIGNED'
    and public.is_eligible_delivery_partner_for(old.order_id)
  then
    return new;
  end if;

  -- Every other non-admin, non-service-role change requires the caller
  -- to already be this delivery's assigned partner.
  if old.transporter_id is distinct from auth.uid() then
    raise exception 'Not authorized to update this delivery';
  end if;

  -- Release: the assigned partner returns an unpicked-up job to the pool
  -- — the one case where transporter_id legitimately moves away from the
  -- caller, back to null.
  if old.status = 'ASSIGNED' and new.status = 'UNASSIGNED' and new.transporter_id is null then
    return new;
  end if;

  -- Anything else: the partner may not reassign the delivery to anyone
  -- (including themselves-as-a-noop-with-a-different-id, which can't
  -- happen anyway, but stated explicitly rather than left implicit) —
  -- only advance status, forward through the legal chain, to FAILED, or
  -- as a same-status no-op.
  if new.transporter_id is distinct from old.transporter_id then
    raise exception 'Delivery partners may not reassign a delivery to someone else';
  end if;

  if not (
    (old.status = 'ASSIGNED' and new.status = 'PICKED_UP')
    or (old.status = 'PICKED_UP' and new.status = 'IN_TRANSIT')
    or (old.status = 'IN_TRANSIT' and new.status = 'DELIVERED')
    or (old.status in ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT') and new.status = 'FAILED')
    or (old.status = new.status)
  ) then
    raise exception 'Invalid delivery status transition for a delivery partner: % -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Checkpoint E-2: notify the buyer the moment their delivery genuinely
-- enters IN_TRANSIT for the first time — tied to the delivery-level event,
-- never to an order-level one. notify_order_status_change() (0008) only
-- fires on orders.order_status changes, and IN_TRANSIT deliberately has no
-- order_status counterpart (advanceDeliveryStatus()'s own ORDER_STATUS_SYNC
-- comment: "IN_TRANSIT intentionally has no entry here") — nothing fires
-- for it today, and this trigger is additive: it does not touch
-- notify_order_status_change() or any other existing trigger.
--
-- Firing condition, and why it's the timestamp and not the status: the
-- guard trigger above already computes "is this genuinely the first time
-- this delivery has ever reached IN_TRANSIT" via in_transit_at, and by the
-- time this AFTER UPDATE trigger runs, new.in_transit_at already reflects
-- whatever that BEFORE UPDATE trigger just set it to (Postgres guarantees
-- BEFORE-trigger row modifications are visible to AFTER triggers within the
-- same statement). Re-deriving that "first time" fact from old.status /
-- new.status instead would be weaker: admin is_admin()/service_role writes
-- bypass the transition whitelist entirely (see the guard trigger above),
-- so a status-only comparison could not by itself guarantee this never
-- double-fires across every admin write shape, present or future — the
-- timestamp already is that guarantee, computed once, in one place. Using
-- it here rather than duplicating the "first time" logic a second way
-- keeps this trigger correct for exactly the same reason E-1's timestamp
-- is correct, and automatically fires from any of the three IN_TRANSIT
-- write paths named in the header comment above (partner advance, admin
-- fallback, admin override) without needing to know about any of them by
-- name.
--
-- security definer + search_path pin, mirroring notify_order_status_
-- change()'s exact shape — needed because notifications has no
-- client-insert policy for any role (0002_rls.sql), the same reason every
-- other notifications insert in this schema goes through either a
-- SECURITY DEFINER function (this one, notify_order_status_change()) or
-- the service-role client from application code. buyer_id is read
-- server-side from orders via new.order_id — never accepted as a
-- parameter, never sourced from a client-supplied value of any kind.
--
-- Reuses the existing order_update notification type rather than adding a
-- new enum value or reusing order_out_for_delivery: that type already
-- belongs to notify_order_status_change()'s own OUT_FOR_DELIVERY case,
-- which fires at PICKED_UP (via ORDER_STATUS_SYNC), a genuinely different
-- moment from IN_TRANSIT — reusing it here would conflate two distinct
-- events under one type tag.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.notify_delivery_in_transit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid;
begin
  if not (old.in_transit_at is null and new.in_transit_at is not null) then
    return new;
  end if;

  select buyer_id into v_buyer_id from public.orders where id = new.order_id;
  if v_buyer_id is null then
    return new;
  end if;

  insert into public.notifications (user_id, type, title, message, data)
  values (
    v_buyer_id,
    'order_update',
    'Delivery in transit',
    'Your delivery partner is now on the way with your order.',
    jsonb_build_object('order_id', new.order_id, 'delivery_id', new.id)
  );

  return new;
end;
$$;

create trigger deliveries_notify_in_transit
  after update on public.deliveries
  for each row execute function public.notify_delivery_in_transit();
