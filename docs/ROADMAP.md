# Roadmap

Phases match the product brief's 24-step process. Each phase should ship
tested and documented before the next begins — see `CLAUDE.md` rule 9.

## Phase 1 — Foundation ✅

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

## Phase 2 — Marketplace ✅

- Farmer product CRUD (`/dashboard/farmer/products`): create, edit,
  pause/resume, delete, with image upload direct to the `product-images`
  storage bucket (`src/components/farmer/product-image-uploader.tsx`).
- Marketplace search, category filter, county filter, price range, and
  sort (newest / price asc / price desc) on `/marketplace`
  (`src/components/marketplace/marketplace-filters.tsx`).
- Product detail page: quantity selector respecting `min_order_quantity`
  and `quantity_available`, similar products, add to cart.
- Cart (`/cart`): add/update/remove, server-side inventory and
  min-order-quantity validation on every mutation
  (`src/lib/actions/cart.ts`) — never trusts a client-submitted quantity.
- Checkout (`/checkout` → `src/lib/actions/checkout.ts`): creates an order
  as `PENDING_PAYMENT`/`PENDING`, recomputing subtotal, platform fee (from
  `platform_settings`), and a flat delivery fee entirely server-side.
  **Does not process payment** — the order confirmation page says so
  explicitly. New `orders`/`order_items` INSERT policies needed for this
  (`supabase/migrations/0005_checkout_policies.sql`), since Phase 1 had
  only specified SELECT/UPDATE for those tables.
- Buyer order history (`/dashboard/buyer/orders`, `/orders/[id]`) and
  farmer order visibility (`/dashboard/farmer/orders`) — read-only; no
  status-transition UI yet, since nothing can leave `PENDING_PAYMENT`
  without Phase 3.
- Cart badge in the site header, real dashboard stats (active listings,
  orders received, total sales) replacing the Phase 1 placeholders.
- A styled 404 page (`src/app/not-found.tsx`).

**Not done in Phase 1/2, and known to be missing:** no automated tests
have been run (no Supabase project exists to run RLS tests against — see
`docs/TESTING.md`); `npm run build`/`npm run lint` pass locally and the UI
has been checked in a real browser (Playwright + Chromium) for rendering
and redirect behavior, but no flow has been exercised against a real
Supabase backend, since none is connected to this environment. Sort by
"popularity" from the original brief isn't implemented — there's no order
data to rank by yet; only newest/price sort exist.

## Phase 3 — Payments

Checkout already creates the order (Phase 2); this phase is purely the
M-PESA Daraja sandbox integration exactly as specified in
`docs/M-PESA.md`: STK push triggered from the existing order, callback
handler, atomic inventory deduction via `deduct_product_inventory()`,
payment reconciliation view for admin, the full M-PESA test plan in
`docs/TESTING.md` passing against sandbox. Production Daraja credentials
are configured only after this phase's tests pass.

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
