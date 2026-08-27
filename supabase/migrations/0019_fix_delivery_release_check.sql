-- ─────────────────────────────────────────────────────────────────────────
-- Fix: deliveries_claim_and_advance_by_partner (0018) never actually let a
-- delivery partner release their own claim, despite guard_delivery_status_
-- update()'s transition whitelist explicitly permitting
-- ASSIGNED -> UNASSIGNED as a self-service release.
--
-- Root cause, confirmed by reading the live policy/trigger text (not
-- assumed): the policy's WITH CHECK was unconditionally
-- `transporter_id = auth.uid()`. Postgres evaluates WITH CHECK against the
-- final new row *after* BEFORE ROW triggers run, and the release branch of
-- guard_delivery_status_update() validates and returns NEW unchanged — it
-- does not rewrite transporter_id. A release UPDATE therefore reaches WITH
-- CHECK with transporter_id already NULL (exactly what the release sets),
-- so `NULL = auth.uid()` evaluates to NULL, not TRUE, and RLS itself
-- rejected the write with "new row violates row-level security policy" —
-- independently of, and despite, the trigger already permitting the
-- transition. This is the same alter-in-place pattern 0012 already used to
-- correct disputes_insert_own_order's WITH CHECK after the fact, applied
-- here to the same underlying situation: a policy that needs the release
-- shape added to what it accepts, not a redesign.
--
-- Fix: WITH CHECK now also accepts the release shape (transporter_id IS
-- NULL and status = 'UNASSIGNED'), in addition to the existing
-- transporter_id = auth.uid() case. USING is untouched — omitting it from
-- this ALTER POLICY leaves it exactly as 0018 defined it, the same way
-- 0012's ALTER POLICY on disputes_insert_own_order left that policy's own
-- USING alone.
--
-- Why this can't be used to release someone else's delivery: USING still
-- gates which rows are reachable at all, unchanged from 0018 —
-- `(status = 'UNASSIGNED' and transporter_id is null and
-- is_eligible_delivery_partner_for(order_id)) or transporter_id =
-- auth.uid()`. For any delivery ASSIGNED to a different partner, both
-- USING branches are false for the caller (status isn't UNASSIGNED, and
-- transporter_id isn't their own auth.uid()), so the row is never
-- reachable for update in the first place — the new WITH CHECK disjunct
-- is never even evaluated against it. guard_delivery_status_update()'s own
-- `old.transporter_id is distinct from auth.uid()` check (0018) is also
-- unchanged and would independently reject such an attempt regardless.
--
-- Nothing else changes: guard_delivery_status_update() is not
-- re-declared, no new function/trigger/index is added, no enum changes,
-- claim's and advance's own WITH CHECK path (transporter_id = auth.uid())
-- is untouched, and no table other than the one existing policy on
-- public.deliveries is touched.
-- ─────────────────────────────────────────────────────────────────────────

alter policy "deliveries_claim_and_advance_by_partner" on public.deliveries
  with check (
    transporter_id = auth.uid()
    or (transporter_id is null and status = 'UNASSIGNED')
  );
