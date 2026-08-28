-- ─────────────────────────────────────────────────────────────────────────
-- Phase F (live GPS delivery tracking) — checkpoint F-1: schema only.
-- No application code, no new enum value, no change to any existing
-- table's own RLS. This migration adds exactly one new table, its own
-- three RLS policies, one reused generic trigger, one new dedicated
-- cleanup trigger, and enables Realtime on the new table.
--
-- Why a new table rather than columns on deliveries: the approved Phase F
-- design requires (a) dedicated RLS distinct from deliveries' own broad,
-- correct, unmodified deliveries_select_participants_or_admin policy
-- (0002_rls.sql) — which buyer/farmer/admin need for order history
-- regardless of delivery status — and (b) that location data "no longer
-- remain available" once a delivery is terminal. Adding lat/lng columns
-- directly to deliveries would mean either weakening that existing policy
-- (forbidden) or relying on the application to simply not query those
-- columns for old orders, which is a convention, not a guarantee. A
-- separate table with `delivery_id` as its own primary key makes both
-- requirements real, database-enforced facts:
--   - one row per delivery, ever (a second position report is an UPSERT
--     that overwrites the existing row in place, not a second INSERT —
--     the primary key makes a location *history* structurally impossible,
--     not just discouraged)
--   - a dedicated, narrower RLS surface that only ever grants visibility
--     into a delivery that is currently ASSIGNED/PICKED_UP/IN_TRANSIT,
--     independent of deliveries' own (correctly) broader policy
-- ─────────────────────────────────────────────────────────────────────────

create table public.delivery_locations (
  delivery_id     uuid primary key references public.deliveries(id) on delete cascade,
  latitude        double precision not null check (latitude between -90 and 90),
  longitude       double precision not null check (longitude between -180 and 180),
  accuracy_meters real,
  recorded_at     timestamptz not null,
  updated_at      timestamptz not null default now()
);

alter table public.delivery_locations enable row level security;

-- Reuses the existing generic set_updated_at() (0001_init.sql) — the same
-- trigger function already used on deliveries/orders/users/etc. No new
-- trigger function needed for this.
create trigger delivery_locations_set_updated_at
  before update on public.delivery_locations
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- RLS. Every policy joins back to deliveries (and orders, for buyer
-- identity) — there is no bare grant on this table. Reuses is_admin() and
-- is_farmer_of_order() exactly as they already exist (0002_rls.sql) — no
-- new helper function, no re-declaration of either.
--
-- The ASSIGNED/PICKED_UP/IN_TRANSIT set below is the same "active delivery"
-- boundary already established by getActiveDelivery()
-- (src/lib/data/current-user.ts, Phase C, checkpoint C6) — not a new
-- definition invented for this table.
--
-- Admin's SELECT grant is deliberately NOT the unconditional is_admin()
-- bypass used elsewhere on this schema (deliveries_admin_write, the
-- guard trigger's own admin branch) — the approved Phase F design scopes
-- admin to "active delivery locations" specifically, so is_admin() is
-- combined with the same status/participation check every other role
-- goes through, not given an unconditional shortcut.
--
-- No DELETE policy of any kind is created — the only writer that removes
-- a row is the cleanup trigger below, which runs security definer and so
-- does not need (and must not be given) a client-facing DELETE grant.
-- No admin write (INSERT/UPDATE) policy either — admin's access to this
-- table is read-only, matching the read-only precedent Phase E's own
-- admin tracking view (checkpoint E-4) already established.
-- ─────────────────────────────────────────────────────────────────────────

create policy "delivery_locations_select_participants_or_admin" on public.delivery_locations
  for select using (
    exists (
      select 1 from public.deliveries d
      join public.orders o on o.id = d.order_id
      where d.id = delivery_locations.delivery_id
        and d.status in ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT')
        and (o.buyer_id = auth.uid() or public.is_farmer_of_order(o.id) or public.is_admin())
    )
  );

create policy "delivery_locations_insert_own_active" on public.delivery_locations
  for insert with check (
    exists (
      select 1 from public.deliveries d
      where d.id = delivery_locations.delivery_id
        and d.transporter_id = auth.uid()
        and d.status in ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT')
    )
  );

create policy "delivery_locations_update_own_active" on public.delivery_locations
  for update using (
    exists (
      select 1 from public.deliveries d
      where d.id = delivery_locations.delivery_id
        and d.transporter_id = auth.uid()
        and d.status in ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT')
    )
  )
  with check (
    exists (
      select 1 from public.deliveries d
      where d.id = delivery_locations.delivery_id
        and d.transporter_id = auth.uid()
        and d.status in ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Cleanup trigger. A third, independent trigger on deliveries — separate
-- from guard_delivery_status_update() (0018, extended by 0020) and
-- notify_delivery_in_transit() (0020) — same separation-of-concerns
-- precedent Phase E already established: each trigger owns exactly one
-- job. This one does not touch, read, or depend on either of the other
-- two, and neither of them is modified by this migration.
--
-- Fires whenever a delivery's status changes to DELIVERED, FAILED, or
-- UNASSIGNED (the released-back-to-the-pool case) — per the approved
-- Phase F design, all three are "tracking must stop, and the data must
-- not remain available" states, not just the first two. Every one of
-- deliveries' own status-changing write paths (advanceDeliveryStatus(),
-- markDeliveryFailed(), releaseClaim(), adminOverrideDeliveryStatus(),
-- syncDeliveryIfUnclaimed()) is a plain UPDATE on this table, so this
-- trigger covers all of them without needing to know about any of them
-- by name — the same reasoning notify_delivery_in_transit() already
-- relies on for its own firing condition.
--
-- security definer + search_path pin so it deletes regardless of which
-- of those paths — partner's own session, admin's session, or
-- service_role — caused the transition, the same pattern every other
-- trigger function in this schema already uses.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.cleanup_delivery_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('DELIVERED', 'FAILED', 'UNASSIGNED')
     and old.status is distinct from new.status then
    delete from public.delivery_locations where delivery_id = new.id;
  end if;
  return new;
end;
$$;

create trigger deliveries_cleanup_location
  after update on public.deliveries
  for each row execute function public.cleanup_delivery_location();

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime. Required for Postgres Changes subscribers (F-3/F-4) to
-- receive updates at all — RLS is still evaluated per-subscriber on top
-- of this, this statement only makes the table eligible to be watched.
-- ─────────────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.delivery_locations;
