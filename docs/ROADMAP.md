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

## Phase 3 — Payments ✅ (code complete; sandbox run still pending)

M-PESA Daraja integration built exactly as specified in `docs/M-PESA.md`:
`src/lib/mpesa/` (OAuth token, STK push, callback parsing, phone
normalization), `src/lib/actions/mpesa.ts` (`initiatePayment`,
`getOrderPaymentStatus`), `src/app/api/mpesa/callback/route.ts`
(shared-secret-checked callback handler), and three atomic Postgres
functions in `supabase/migrations/0006_mpesa.sql`
(`record_stk_initiation`, `confirm_mpesa_payment`, `fail_mpesa_payment`)
that own every write to `payments`/`orders` money-lifecycle columns —
buyers can't touch them directly (see that migration's header). The order
page (`/orders/[id]`) now has a real "Pay with M-PESA" form that polls
for the result instead of the Phase 2 placeholder text. `/admin/payments`
adds reconciliation (counts, gross transaction value, per-payment list —
also summarized on `/admin`).

**Not done:** the full flow has never run against Daraja sandbox — this
environment has neither sandbox credentials nor a live Supabase project,
so `docs/TESTING.md` §M-PESA test plan is unexecuted by necessity, not by
oversight. What has been verified: `npm run build`/`npm run lint` pass;
the callback route was hit directly and confirmed to fail loudly
(`SUPABASE_SERVICE_ROLE_KEY is not configured`) rather than silently
succeed, when no backend is configured. Whoever picks this up next needs
to: create a Daraja sandbox app, set the six `MPESA_*` env vars plus
`MPESA_CALLBACK_SECRET`, expose a public callback URL (`ngrok` in dev),
and run the full test plan before this phase can be called done.

## Phase 4 — Intelligence ✅ (code complete; never run against Claude)

KilimoSync AI built per `docs/AI.md`: server-side tool-calling layer
(`src/lib/ai/`), buyer tools (`search_products`, `get_product`,
`get_user_orders`), farmer tools (`get_farmer_products`,
`get_farmer_sales`, `create_product_draft` — draft-then-confirm, the tool
itself never writes to the database), admin tool
(`get_platform_analytics`), a chat UI at `/dashboard/assistant` (buyer or
farmer, role read from the session) and `/admin/assistant`, DB-backed
rate limiting and full request logging (`ai_usage_logs`,
`supabase/migrations/0007_ai.sql`).

**Not done:** this environment has no `ANTHROPIC_API_KEY`, so no message
has actually reached Claude — `runAgent()`'s tool-calling loop is
unexercised beyond `npm run build`/`npm run lint` passing. What was
verified directly: `getAiConfig()` returns a typed error instead of
throwing when the key is missing, and hitting `/api/ai/chat` with no
Supabase project configured returns a clean 401 (not a 500) — the same
"fail loudly, never fake success" check applied to Phase 3. Whoever picks
this up next needs to: set `ANTHROPIC_API_KEY` (and optionally
`ANTHROPIC_MODEL`), sign in as each role, and manually verify each tool
in `docs/AI.md`'s table returns real data and that the hard constraints
hold — particularly that `create_product_draft` never results in a
listing existing until the farmer submits the pre-filled form themselves.

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
