-- ─────────────────────────────────────────────────────────────────────────
-- Phase B (delivery-partner identity) — step 2 of 2 (B2 checkpoint).
--
-- Builds on 0016 (which added 'delivery_partner' to public.user_role,
-- alone, in its own committed transaction — see that file for why). This
-- migration is schema/RLS/security only: the delivery_partner_profiles
-- table, its indexes, its RLS policies, and the two guard mechanisms that
-- enforce the account-state invariants from the approved Phase B design.
--
-- Deliberately NOT in this migration (reserved for the B3 checkpoint,
-- "signup flow"): handle_new_user() is not touched here, so public
-- signup still cannot produce a delivery_partner user yet — the role
-- exists in the enum (0016) but nothing issues it until B3 wires up
-- signUpSchema + handle_new_user() together. That keeps this checkpoint
-- testable in isolation, directly against the database, before any app
-- code depends on it.
--
-- Mirrors farmer_profiles (0001_init.sql) wherever the same shape
-- applies — same 1:1-with-users structure, same admin-only verification
-- guard-trigger pattern (guard_farmer_verification_update()) — with two
-- deliberate deviations, both called out below: this table is NOT
-- public-read, and account status is NOT duplicated here (users.is_suspended
-- is reused, per the approved role-architecture decision).
-- ─────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────
-- New enum types. Both are brand-new types, not an ADD VALUE on an
-- existing one, so — unlike 0016 — they can be created and used in the
-- same transaction with no restriction.
-- ─────────────────────────────────────────────────────────────────────────

create type public.vehicle_type as enum ('bicycle', 'motorbike', 'car', 'van', 'on_foot');

create type public.delivery_availability_status as enum ('AVAILABLE', 'UNAVAILABLE');

-- ─────────────────────────────────────────────────────────────────────────
-- delivery_partner_profiles
--
-- name/phone/profile photo are deliberately NOT duplicated here — they
-- already live on public.users (name, phone, profile_image), reused
-- exactly as farmer_profiles reuses them. Account suspension is likewise
-- not duplicated: public.users.is_suspended is the single source of
-- truth for "is this login allowed to act at all," across every role,
-- per the approved role-architecture decision (see the availability
-- guard trigger below for how it's actually enforced against this table).
-- ─────────────────────────────────────────────────────────────────────────

create table public.delivery_partner_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  vehicle_type public.vehicle_type not null,
  vehicle_registration text,
  operating_county text not null,
  verification_status public.verification_status not null default 'pending',
  verified_at timestamptz,
  verified_by uuid references public.users(id),
  availability_status public.delivery_availability_status not null default 'UNAVAILABLE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Makes "PENDING + AVAILABLE" (and REJECTED/SUSPENDED + AVAILABLE)
  -- structurally impossible, not just app-discouraged: both columns are
  -- on this same row, so a plain CHECK constraint is sufficient — no
  -- trigger needed for this half of the account-state invariant.
  constraint delivery_partner_profiles_availability_requires_verified
    check (availability_status = 'UNAVAILABLE' or verification_status = 'verified')
);

create index delivery_partner_profiles_verification_idx
  on public.delivery_partner_profiles(verification_status);
create index delivery_partner_profiles_county_idx
  on public.delivery_partner_profiles(operating_county);

create trigger delivery_partner_profiles_set_updated_at
  before update on public.delivery_partner_profiles
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────

alter table public.delivery_partner_profiles enable row level security;

create policy "delivery_partner_profiles_select_own_or_admin" on public.delivery_partner_profiles
  for select using (user_id = auth.uid() or public.is_admin());

-- Deliberate Phase B simplification, not a permanent architectural
-- commitment — flagged per the approved role-architecture decision:
--
-- current_role() = 'delivery_partner' assumes a user's role column can
-- hold exactly one value, so only someone whose SOLE role is already
-- delivery_partner can ever create this profile. That is correct under
-- the single-role model this project is deliberately keeping for Phase B
-- (see the "ROLE ARCHITECTURE DECISION" this migration implements), but
-- it is the first thing a future multi-role model (e.g. an existing
-- farmer or buyer applying to also become a delivery partner without
-- losing their current role) would need to revisit — most likely
-- replacing this predicate with a check against a separate multi-role
-- membership mechanism, not current_role(). Nothing else in this
-- migration — the table shape, the other policies, the guard triggers —
-- depends on the role column being single-valued, so this is expected to
-- be the one line that changes.
create policy "delivery_partner_profiles_insert_own" on public.delivery_partner_profiles
  for insert with check (user_id = auth.uid() and public.current_role() = 'delivery_partner');

create policy "delivery_partner_profiles_update_own_or_admin" on public.delivery_partner_profiles
  for update using (user_id = auth.uid() or public.is_admin());

-- No public/buyer/farmer select policy exists, unlike farmer_profiles'
-- public-read policy — a delivery partner's profile is not storefront
-- information. Default-deny applies to every role without an explicit
-- grant above, exactly as everywhere else in this schema.

-- ─────────────────────────────────────────────────────────────────────────
-- guard_delivery_partner_verification_update()
--
-- Mirrors guard_farmer_verification_update() (0002_rls.sql): RLS's USING
-- clause above already lets a delivery partner UPDATE their own row —
-- this trigger is what stops them from ever setting verification_status/
-- verified_at/verified_by themselves, regardless of that row-level
-- access. Same division of labor as everywhere else in this schema: RLS
-- decides which rows, the trigger decides which columns.
--
-- One deliberate exception, per the approved Phase B design (§4 of the
-- design document): a rejected applicant may move their own row from
-- rejected back to pending — an explicit "please look again" signal —
-- without becoming an admin action, provided verified_at/verified_by
-- stay untouched (they record the prior admin decision, not a new one).
-- No other non-admin transition on these three columns is permitted.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.guard_delivery_partner_verification_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if old.verification_status = 'rejected'
    and new.verification_status = 'pending'
    and new.verified_at is not distinct from old.verified_at
    and new.verified_by is not distinct from old.verified_by
  then
    return new;
  end if;

  if new.verification_status is distinct from old.verification_status
    or new.verified_at is distinct from old.verified_at
    or new.verified_by is distinct from old.verified_by
  then
    raise exception 'Only an admin may change delivery partner verification status';
  end if;

  return new;
end;
$$;

create trigger guard_delivery_partner_verification_update
  before update on public.delivery_partner_profiles
  for each row execute function public.guard_delivery_partner_verification_update();

-- ─────────────────────────────────────────────────────────────────────────
-- guard_delivery_partner_availability_update()
--
-- The other half of the account-state invariant from the approved Phase
-- B design: "SUSPENDED + AVAILABLE" must be impossible. Verification
-- lives on this table but suspension lives on public.users, so a
-- same-row CHECK constraint can't reach across tables — this requires a
-- trigger. Deliberately narrow in scope, per the design document's own
-- recommendation: this only blocks a suspended partner from being set
-- back to AVAILABLE; it does not reach into public.users or touch
-- guard_user_self_update() in any way, and it does not force-flip
-- availability_status the moment an admin suspends someone already
-- AVAILABLE (flagged in the design as a "nice-to-have, not required for
-- Phase B" hardening — Phase B has no job-matching query yet for that
-- narrow window to matter against; Phase C's eventual matching query is
-- expected to check users.is_suspended directly, closing this at the
-- point it actually becomes load-bearing).
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.guard_delivery_partner_availability_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.availability_status = 'AVAILABLE' then
    if exists (
      select 1 from public.users where id = new.user_id and is_suspended
    ) then
      raise exception 'A suspended delivery partner cannot be set to available';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_delivery_partner_availability_update
  before insert or update on public.delivery_partner_profiles
  for each row execute function public.guard_delivery_partner_availability_update();
