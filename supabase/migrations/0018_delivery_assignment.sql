-- ─────────────────────────────────────────────────────────────────────────
-- Phase C (delivery assignment) — checkpoint C2: eligibility, RLS, and the
-- delivery status guard trigger. Schema/security only — no application
-- code, no new enum values (delivery_status already fits the intended
-- lifecycle exactly), and deliberately NO deliveries -> orders sync
-- trigger (see the note before guard_delivery_status_update() below for
-- why that would silently reintroduce the auth.role()/SECURITY DEFINER
-- bug already fixed in 0013/0014 — the sync stays in the application/
-- service-role path, per the approved Phase C design).
--
-- Pre-flight, confirmed by reading the live schema before writing this
-- file: deliveries_select_participants_or_admin (0002_rls.sql) grants a
-- delivery partner visibility only via `transporter_id = auth.uid()`,
-- which is false for every UNASSIGNED row (transporter_id is null there)
-- — no partner can see any unclaimed job today. deliveries_admin_write is
-- the only write policy that exists. No object name below collides with
-- anything in 0001-0017.
-- ─────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────
-- Eligibility helper. SECURITY DEFINER for the same reason is_admin() /
-- is_farmer_of_order() / owns_farmer_profile() already are: a plain RLS
-- subquery referencing orders directly would itself be subject to
-- orders' own RLS (orders_select_buyer_farmer_admin), which grants a
-- delivery partner nothing at all — the subquery would silently see zero
-- rows even for a genuinely eligible match, RLS blocking RLS. This
-- function reads across delivery_partner_profiles/users/orders on the
-- caller's behalf, exactly the same deliberate bypass every existing
-- helper in this schema already relies on.
--
-- Answers one question only, for the current session: is auth.uid()
-- eligible to see/claim the UNASSIGNED delivery for this order? It is not
-- a general-purpose data access path — it returns a boolean, nothing else,
-- and every condition is evaluated against auth.uid(), never a caller-
-- supplied identity.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.is_eligible_delivery_partner_for(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.delivery_partner_profiles dp
    join public.users u on u.id = dp.user_id
    join public.orders o on o.id = p_order_id
    where dp.user_id = auth.uid()
      and u.role = 'delivery_partner'
      and dp.verification_status = 'verified'
      and dp.availability_status = 'AVAILABLE'
      and not u.is_suspended
      and dp.operating_county = o.delivery_county
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Post-claim visibility helpers. Two directions of the same relationship:
-- the assigned partner reading the one order they need (buyer/farmer
-- info, delivery address), and the buyer/farmer of that order reading
-- who the assigned partner is (name via users, vehicle via
-- delivery_partner_profiles). Both SECURITY DEFINER for the same
-- RLS-recursion-avoidance reason as above.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.is_assigned_delivery_partner_of(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.deliveries d
    where d.order_id = p_order_id and d.transporter_id = auth.uid()
  );
$$;

create or replace function public.is_order_participant_of_delivery_partner(p_delivery_partner_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.deliveries d
    join public.orders o on o.id = d.order_id
    where d.transporter_id = p_delivery_partner_user_id
      and (o.buyer_id = auth.uid() or public.is_farmer_of_order(o.id))
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- New RLS. deliveries_select_participants_or_admin, deliveries_admin_write
-- (both 0002) are unchanged — they already correctly serve buyer, farmer,
-- and admin visibility, and admin's unrestricted write/reassignment
-- capability. Only what's missing is added:
--
--   1. Eligible-partner visibility into UNASSIGNED jobs (didn't exist).
--   2. A single, combined partner write policy covering claim, release
--      (before pickup), and status advance. A first draft split this
--      into two separate UPDATE policies (claim vs. advance) — dropped
--      in favor of one, because Postgres combines multiple permissive
--      UPDATE policies' USING clauses with OR but each policy's own WITH
--      CHECK is still evaluated independently, which made it ambiguous
--      which CHECK actually governs a given transition. A single policy
--      with one USING (reachable if eligible-and-unassigned, OR already
--      mine) and one WITH CHECK (the new row's transporter_id must be me)
--      removes that ambiguity entirely. Transition legality itself is
--      the guard trigger's job below, not RLS's — the same division of
--      labor as every other guarded table in this schema.
--   3. Narrow, assignment-scoped visibility on orders/delivery_partner_
--      profiles/users — none of which grant anything before an
--      assignment exists, and all three close automatically once a
--      delivery moves off the assigned partner (no assignment, no
--      is_assigned_delivery_partner_of() match, no grant).
-- ─────────────────────────────────────────────────────────────────────────

create policy "deliveries_select_available_for_eligible_partners" on public.deliveries
  for select using (
    status = 'UNASSIGNED'
    and transporter_id is null
    and public.is_eligible_delivery_partner_for(order_id)
  );

create policy "deliveries_claim_and_advance_by_partner" on public.deliveries
  for update using (
    (status = 'UNASSIGNED' and transporter_id is null and public.is_eligible_delivery_partner_for(order_id))
    or transporter_id = auth.uid()
  )
  with check (
    transporter_id = auth.uid()
  );

create policy "orders_select_assigned_delivery_partner" on public.orders
  for select using (public.is_assigned_delivery_partner_of(id));

create policy "delivery_partner_profiles_select_for_order_participants" on public.delivery_partner_profiles
  for select using (public.is_order_participant_of_delivery_partner(user_id));

create policy "users_select_assigned_delivery_partner" on public.users
  for select using (public.is_order_participant_of_delivery_partner(id));

-- ─────────────────────────────────────────────────────────────────────────
-- Two indexes the new queries actually filter on. Neither existed before
-- this migration.
-- ─────────────────────────────────────────────────────────────────────────

create index deliveries_status_idx on public.deliveries(status);
create index deliveries_transporter_idx on public.deliveries(transporter_id);

-- ─────────────────────────────────────────────────────────────────────────
-- guard_delivery_status_update() — column/transition-level enforcement,
-- mirroring guard_order_status_update()'s exact shape (auth.role() for
-- the service_role bypass, not session_user/current_user — this project
-- has already paid for that lesson once and it is not being re-learned
-- here). RLS above decides which ROWS a partner can reach; this trigger
-- decides which COLUMNS and which TRANSITIONS are legal, independently —
-- it re-derives eligibility for the claim case rather than trusting the
-- RLS policy that already let the row through, the same discipline
-- guard_order_status_update() applies by re-checking is_farmer_of_order()
-- itself instead of trusting its own RLS policy alone.
--
-- Explicitly NOT built as a trigger that also writes to orders. Tracing
-- that through: a trigger's own internal `update orders ...` would still
-- fire guard_order_status_update(), and auth.role() would still reflect
-- the *original* caller (a delivery partner's authenticated session) —
-- not service_role, since SECURITY DEFINER changes execution privilege,
-- never the per-request GUC auth.role() reads. is_admin() and
-- is_farmer_of_order() would both be false for that caller too, and the
-- sync would be rejected with "Not authorized to update this order" —
-- reintroducing the exact failure class already lived through in
-- 0008 -> 0013 -> 0014, by a different mechanism. The deliveries -> orders
-- sync stays in the application/service-role path (C3-C5), reusing the
-- already-correct auth.role() = 'service_role' bypass exactly as
-- record_stk_initiation()/confirm_mpesa_payment() already do — not
-- rebuilt here as a new database mechanism.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.guard_delivery_status_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

create trigger deliveries_guard_status_update
  before update on public.deliveries
  for each row execute function public.guard_delivery_status_update();
