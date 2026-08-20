# Roadmap

Phases match the product brief's 24-step process. Each phase should ship
tested and documented before the next begins — see `CLAUDE.md` rule 9.

## Phase 1 — Foundation ✅ (this commit)

- Brand identity: palette as design tokens, SVG logo/favicon.
- Full database schema + RLS policies + storage buckets
  (`supabase/migrations/`).
- Auth: sign up (buyer/farmer only), login, logout, password reset,
  session persistence via middleware, protected routes.
- Farmer onboarding: create farm profile (pending verification).
- Admin: farmer verification queue (verify/reject), real (non-fabricated)
  platform counts.
- Marketing site: full landing page per the brief, with an honest empty
  state for "Featured produce" instead of fake listings.
- Marketplace: read-only public browsing of real `active` products (no
  cart/checkout yet).
- Documentation: this file and the rest of `docs/`.

**Not done in Phase 1, and known to be missing:** no automated tests have
been run (no Supabase project exists to run RLS tests against — see
`docs/TESTING.md`); `npm run build`/`npm run lint` have been run locally
but the app has not been exercised against a real backend.

## Phase 2 — Marketplace

Product CRUD for farmers (with image upload against the storage buckets
that already exist), category/location/price/availability filters and
search on `/marketplace`, cart, checkout UI (no payment yet — order
created `PENDING_PAYMENT`), inventory display and min-order-quantity
enforcement.

## Phase 3 — Payments

M-PESA Daraja sandbox integration exactly as specified in
`docs/M-PESA.md`: STK push, callback handler, atomic inventory deduction
via `deduct_product_inventory()`, payment reconciliation view for admin,
the full M-PESA test plan in `docs/TESTING.md` passing against sandbox.
Production Daraja credentials are configured only after this phase's
tests pass.

## Phase 4 — Intelligence

KilimoSync AI per `docs/AI.md`: server-side tool-calling layer, buyer
search/recommend tools, farmer listing-assistant tools (draft-then-confirm,
never auto-publish), admin analytics tools, rate limiting and logging.

## Phase 5 — Operations

Order status notifications (buyer/farmer/admin, using the `notifications`
table that already exists), reviews (one per completed order item — schema
already enforces this), disputes workflow, delivery coordination UI over
the existing `deliveries` table.

## Phase 6 — Expansion (not built; schema allows it)

Transporter role (signup → verification → job board → accept → pickup →
deliver → earnings) using `deliveries.transporter_id`, which already
exists and is nullable for exactly this reason. Agent role for
farmer registration/verification assistance. B2B buyers (restaurants,
hotels, schools) with bulk/recurring orders and invoicing — would need new
tables (`business_accounts`, recurring order schedules) but no changes to
the existing core tables.

## Business model

Transaction commission via `platform_settings.platform_fee_percent`
(default 5%, admin-configurable, computed server-side — see
`docs/M-PESA.md` §Platform fee). Future: delivery commission, premium
farmer accounts, featured listings, B2B subscriptions — not built, no
schema blockers.

## Launch plan

Pilot with 5–10 farmers and 10–20 buyers in one geographic area before
wider rollout (per `docs/DEPLOYMENT.md`). Do not skip the pilot.
