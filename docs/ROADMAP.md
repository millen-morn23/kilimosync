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

## Phase 5 — Operations ✅

- **Order lifecycle:** a farmer can move their own paid order
  `CONFIRMED → PREPARING → READY_FOR_DELIVERY`
  (`/dashboard/farmer/orders`); an admin takes it from there,
  `→ OUT_FOR_DELIVERY → DELIVERED → COMPLETED` (`/admin/orders`), which
  also upserts a `deliveries` row. All enforced in Postgres, not just the
  UI — `orders_update_farmer_of_order` policy +
  `guard_order_status_update()` trigger (`0008_orders_lifecycle.sql`).
- **Notifications, for real:** a generic `notify_order_status_change`
  trigger fires a buyer notification on every `order_status` change
  regardless of which code path caused it (farmer, admin, or the M-PESA
  functions), so this couldn't drift out of sync the way a
  remember-to-call-it-everywhere approach would. Buyer also gets
  payment-result notifications; farmer gets new-order and low-stock
  alerts (extended into `confirm_mpesa_payment()`/`fail_mpesa_payment()`);
  admin gets new-farmer-signup and dispute-opened alerts. A bell icon
  with unread count sits in every header; `/notifications` lists and
  marks them read.
- **Reviews:** `/orders/[id]` shows a rating form per line item once an
  order is `COMPLETED` (schema already prevented duplicates and
  non-completed reviews — Phase 5 just adds the UI/action); ratings show
  on `/marketplace/[slug]`.
- **Disputes:** a buyer can report a problem from a paid order
  (`/orders/[id]`); `/admin/disputes` lists them with a respond/resolve
  flow that notifies the buyer and writes an `audit_logs` row.

**Not done:** none of this has been exercised against a live Supabase
project — same caveat as every prior phase in this environment. The
`guard_order_status_update()` trigger's `service_role` bypass (needed so
the M-PESA functions' own order updates don't get rejected by the
farmer/admin check meant for human actors — see `docs/DATABASE.md`) is
new, non-obvious code and is the single highest-value thing to verify
first once a live project exists: confirm a successful M-PESA payment
still correctly flips `order_status` to `CONFIRMED` after this change.
No refund flow exists (`order_status = 'REFUNDED'` has no code path).
The admin `updateOrderStatus()` path technically also permits
`CANCELLED`, but no UI exposes it — see the "known gap" note in
`docs/DATABASE.md`'s order-status-vocabulary section for why (no
inventory restock logic exists yet, so shipping the button without it
would be a real bug, not a convenience).

## Phase 5.5 — Analytics & hardening ✅

Requested as a "finish the MVP, don't move to M-PESA production or
Phase 6 yet" pass — admin analytics, a regression review of everything
built so far, and demo data, explicitly **without** connecting real
Daraja/Anthropic/Supabase credentials.

- **Admin analytics** (`/admin/analytics`): overview KPIs, orders/GTV/
  platform-revenue over time (7d/30d/90d/12mo), user growth, top
  products, top categories, county activity — filterable by period,
  county, category, and order status. All aggregation is server-side SQL
  (`0009_analytics.sql`), never a raw table pulled into Node or the
  browser just to sum it. See `docs/ARCHITECTURE.md` §Analytics and
  `docs/DATABASE.md` §Analytics for the architecture and the exact
  financial-metric definitions (GTV and platform revenue are computed
  from `payment_status = 'PAID'` only, never from an order that merely
  exists — matching Phase 3's payment-reconciliation view, not a second,
  possibly-disagreeing definition of "revenue").
- **Regression review** (code-level, not live — see `docs/TESTING.md`
  for exactly what that means and doesn't mean here): found and fixed one
  real bug (`products.slug` was only unique per-farmer, but the product
  detail page looks it up globally — `0010_global_product_slugs.sql`) and
  one real accessibility gap (two icon-only quantity-stepper buttons had
  no `aria-label`). Confirmed via code review, not live execution: M-PESA
  duplicate-callback protection, the `service_role` trigger bypass,
  inventory-double-deduction protection, AI role-scoping, and
  reviews/disputes authorization all still hold as designed.
- **Demo data**: `npm run seed:demo`
  (`scripts/seed-demo-data.ts`) creates ~10 real, loginable farmer
  accounts, 3 buyers, and 15+ products per of the 8 categories (136
  products total across the default template set) via the Supabase Admin
  API — not raw `auth.users` inserts, and not a numbered migration (see
  `docs/DATABASE.md` §Demo data for why). **Has not been run** — this
  environment has no live Supabase project to run it against, so the
  `Category | Product Count` report the product brief asked for cannot
  actually be produced here. The script prints it the moment someone
  runs it against a real project.
- **Mobile/accessibility**: reviewed every page reachable without
  authentication at a 375px viewport (landing, marketplace, login,
  signup) via Playwright screenshots — no responsive issues found beyond
  the aria-label fix above. Pages requiring auth (dashboards, checkout,
  analytics itself) could not be visually verified end-to-end without a
  live project; their responsive Tailwind classes were reviewed in code
  instead (see `docs/TESTING.md`).

**Not done, stated plainly:** nothing in this phase has run against a
live Supabase project, so "verified" throughout means "reviewed and
reasoned through," not "clicked through with a real account." The
`CANCELLED`/`REFUNDED` order-status gap noted above is real and
unresolved. Platform-wide admin *product* management (editing/removing
any farmer's listing as an admin, distinct from the farmer's own product
CRUD from Phase 2) is still not built. `users.is_suspended` is DB-level
scaffolding only: the column and the `guard_user_self_update` trigger
restricting it to admins both exist (`docs/DATABASE.md`), but there is no
admin UI to set it and nothing anywhere in the app reads it to actually
block a suspended account — the marketing copy's "Suspicious accounts can
be suspended" is aspirational, not live. Wiring this up properly needs an
admin users page, a real "account suspended" UX (not just a silent
redirect loop against a still-valid auth session), and a sign-out path
that clears cookies from a Server Action/Route Handler rather than a
Server Component — deliberately deferred as its own scoped piece of work
rather than rushed into this audit pass.

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
