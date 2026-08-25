# Database

Schema lives in `supabase/migrations/*.sql`, applied in filename order.
`src/lib/supabase/types.ts` is a hand-maintained mirror for TypeScript —
regenerate it from the live project once one exists (see `CLAUDE.md`).

## Entities

| Table | Purpose | Key notes |
|---|---|---|
| `users` | Profile extending `auth.users` (1:1) | Created by the `handle_new_user` trigger on signup, never by client insert. `role` and `is_suspended` can only be changed by an admin (`guard_user_self_update` trigger) — not just an RLS policy, so even a service-role misuse in application code would need to explicitly override, not accidentally slip through. `is_suspended` write-protection is live; *enforcement* is not — no admin UI sets it and no app code reads it to block a suspended account yet, see `docs/ROADMAP.md` Phase 5.5. |
| `farmer_profiles` | Storefront data for a farmer | Public read (farm name/county/verification are storefront info). `verification_status`/`verified_at`/`verified_by` are admin-only writes, enforced by `guard_farmer_verification_update` trigger. |
| `categories` | Product taxonomy | Public read, admin write. Seeded once in `0003_seed_categories.sql` — taxonomy, not sample listings. |
| `products` | Farmer listings | `status='active'` is publicly visible; other statuses only to the owning farmer/admin. `slug` is globally unique (`products_slug_key`, `0010_global_product_slugs.sql`) — it was originally `unique(farmer_id, slug)`, a bug caught in the Phase 5.5 regression review: `/marketplace/[slug]` looks a product up by slug alone, so two farmers naming a product the same thing would have collided the moment both listings existed. |
| `carts` / `cart_items` | Buyer's in-progress order | Strictly buyer-owned. |
| `orders` | One purchase | Buyer sees own (insert-only, via checkout — no direct update); a farmer sees an order only if one of their products is in it (`is_farmer_of_order()`) and, as of Phase 5, may update `order_status` (only) on it, restricted to `CONFIRMED → PREPARING → READY_FOR_DELIVERY` by `guard_order_status_update()` (`0008_orders_lifecycle.sql`); admin can update anything. Created by the checkout Server Action (`src/lib/actions/checkout.ts`) — `orders_insert_own`/`order_items_insert_own_order` (`0005_checkout_policies.sql`) restrict that insert to the buyer's own `buyer_id`, so money math still can't be forged from the client even though the RLS-respecting client (not the service role) performs the write. Every `order_status` change, from any actor, fires `notify_order_status_change()` (buyer notification) automatically — see below. |
| `order_items` | Snapshot of purchased line items | `product_name_snapshot` / `price_at_purchase` are copied at purchase time and never re-derived from `products`, so historical orders stay accurate if a product is later edited, paused, or deleted. |
| `payments` | M-PESA payment record | Buyer + admin only — **never** exposed to farmers. No RLS insert/update policy for any client role exists; every write goes through `record_stk_initiation()`, `confirm_mpesa_payment()`, or `fail_mpesa_payment()` (`0006_mpesa.sql`, extended with notification inserts in `0008_orders_lifecycle.sql`), which are `REVOKE`d from `public`/`anon`/`authenticated` and callable only by `service_role` — see `docs/M-PESA.md`. |
| `deliveries` | Manual delivery coordination (MVP) | `transporter_id` references `users` and is nullable — reserved for the future transporter role without a schema change. Admin-only read/write (`deliveries_admin_write`); populated by `src/lib/actions/orders.ts` when an admin marks an order `OUT_FOR_DELIVERY`/`DELIVERED`. |
| `notifications` | In-app notifications | Strictly own; no client insert policy (server/service-role only), but genuinely populated as of Phase 5 — order status changes (`notify_order_status_change` trigger), payment result and low-stock alerts (`confirm_mpesa_payment`/`fail_mpesa_payment`), new farmer signup (`createFarmerProfile` action), dispute opened/resolved (`src/lib/actions/disputes.ts`). See `docs/ROADMAP.md` Phase 5 for the full per-role list and what's still missing. |
| `reviews` | Post-purchase rating | Public read (storefront proof, shown on `/marketplace/[slug]`); one review per `order_item_id` (unique constraint) and only for a `COMPLETED` order, enforced in the insert policy itself, not just app code. `src/lib/actions/reviews.ts` re-derives `product_id`/`farmer_id` from the order item server-side rather than trusting them from the client. |
| `disputes` | Buyer-raised issue on an order | Buyer/involved farmer/admin read; buyer insert (own order only); only admin can update status (`src/lib/actions/disputes.ts` → `/admin/disputes`), which notifies admins on open and the buyer on resolve/reject. |
| `audit_logs` | Sensitive-action trail | Admin read only; no client insert policy — always written via the service-role client from server actions, after the actor's admin status has already been verified through the RLS-respecting client. |
| `platform_settings` | Singleton row, transaction fee % | Read by any authenticated user (needed to show the fee at checkout); admin-only update. |
| `ai_usage_logs` | KilimoSync AI request log | Admin read only (`0007_ai.sql`); written exclusively by `/api/ai/chat` via the service-role client, after identity is verified — doubles as the backing store for that endpoint's per-user rate limit. See `docs/AI.md`. |

## Status vocabularies

The product brief lists order lifecycle and payment lifecycle states
together in one list. They're modeled as two separate enums because an
order and its payment are different entities with different write paths:

- `payment_status` (shared by `orders.payment_status` and
  `payments.status`): `PENDING`, `STK_SENT`, `PROCESSING`, `PAID`,
  `FAILED`, `CANCELLED`, `TIMEOUT`.
- `order_status` (`orders.order_status`): `PENDING_PAYMENT`, `CONFIRMED`,
  `PREPARING`, `READY_FOR_DELIVERY`, `OUT_FOR_DELIVERY`, `DELIVERED`,
  `COMPLETED`, `CANCELLED`, `REFUNDED`, `DISPUTED`.

An order cannot legitimately move past `CONFIRMED` while its
`payment_status` isn't `PAID`. Checkout (Phase 2, `src/lib/actions/checkout.ts`)
always creates orders as `PENDING_PAYMENT`/`PENDING` — it never sets either
status further ahead. Advancing to `PAID`/`CONFIRMED` (or `DISPUTED`, on
an oversold order) is `confirm_mpesa_payment()`'s job; advancing
`payment_status` to `FAILED`/`CANCELLED`/`TIMEOUT` without touching
`order_status` is `fail_mpesa_payment()`'s job (both `0006_mpesa.sql`,
called only from the M-PESA callback handler). From `CONFIRMED` onward,
`order_status` progresses through a farmer-driven leg
(`PREPARING` → `READY_FOR_DELIVERY`, `src/lib/actions/orders.ts` →
`updateOrderStatus`, guarded by `guard_order_status_update()`) and then an
admin-driven leg (`OUT_FOR_DELIVERY` → `DELIVERED` → `COMPLETED`, same
action, same guard trigger's admin bypass) — see `docs/ROADMAP.md` Phase 5.

**Known gap, found in the Phase 5.5 regression review, not yet closed:**
`updateOrderStatus()`'s admin path also technically permits `CANCELLED`
(`src/lib/actions/orders.ts`), and `guard_order_status_update()` doesn't
block it (admin is unrestricted there by design). But no UI exposes a
"cancel order" action, and — the actual reason it's not exposed — nothing
restocks `products.quantity_available` if a `CONFIRMED`-or-later order
(whose inventory was already deducted at payment confirmation) gets
cancelled. Adding the button without the restock logic would be a real
inventory-accounting bug reachable from the admin UI, so it was left out
rather than shipped half-working. `REFUNDED` has no code path at all (no
refund flow exists). Both need a real design pass, not a quick patch —
tracked in `docs/ROADMAP.md`.

## Row Level Security

Every table is `ENABLE ROW LEVEL SECURITY`. Helper functions
(`current_role()`, `is_admin()`, `owns_farmer_profile()`,
`is_farmer_of_order()`) are `SECURITY DEFINER` to avoid RLS recursion when
a policy needs to check another table. Full policy list:
`supabase/migrations/0002_rls.sql` (plus additions in `0005`, `0008`).
Negative-path tests for this file are specified in `docs/TESTING.md` and
must be run against any live project before it's considered
production-ready — they have not been run yet because no live Supabase
project is connected to this environment.

**A subtlety worth knowing if you touch `guard_order_status_update()`:**
RLS itself is bypassed entirely for the `service_role` connection the
M-PESA functions run as (that's what `service_role` means in Postgres),
but `BEFORE`/`AFTER` triggers are *not* part of RLS and fire regardless.
That trigger therefore has to explicitly let `service_role` through
(`if session_user = 'service_role' then return new; end if;`) — and it
checks `session_user`, not `current_user`, because `current_user` is
swapped to the function's *owner* during `SECURITY DEFINER` execution and
so can't see who actually issued the query; `session_user` isn't
affected by that and reflects the real connecting role. Getting this
backwards silently breaks the M-PESA confirm/fail functions' own
`UPDATE ... orders` statements, since they'd otherwise fail the same
"are you the farmer or admin of this order" check meant for the app's
own farmer/admin actions.

## Inventory

See `docs/ARCHITECTURE.md` §Inventory concurrency for the atomic-deduction
function and its documented known limitation.

## Analytics

Six `security invoker` SQL functions (`0009_analytics.sql`) back
`/admin/analytics` — see `docs/ARCHITECTURE.md` §Analytics for why
`security invoker` (RLS-respecting, unlike the M-PESA functions) was the
right choice here. `EXECUTE` is revoked from `anon`, granted to
`authenticated`.

| Function | Returns | Scope |
|---|---|---|
| `admin_analytics_overview()` | One row of platform-wide counts | All-time |
| `admin_orders_over_time(start, end, bucket, county?, statuses?)` | Bucketed order count / paid count / GTV / platform revenue | Date range; optional county and order-status filter |
| `admin_user_growth(start, end, bucket)` | Bucketed new buyers / new farmers / newly-verified farmers | Date range |
| `admin_top_products(start, end, category?, county?, limit)` | Product, category, units sold, revenue | Date range; optional category/county filter; **PAID orders only** |
| `admin_top_categories(start, end, county?, limit)` | Category, order count, units sold, transaction value | Date range; optional county filter; **PAID orders only** |
| `admin_county_activity()` | Every county with a farmer or an order: farmer count, buyer count, order count, transaction value | All-time |

**Financial metric definitions** — the one thing every one of these
functions agrees on, and the thing to get right if you touch any of
them: "gross transaction value" and "platform revenue" are **always**
computed from `orders.payment_status = 'PAID'`, never from an order that
merely exists or a payment that failed/was cancelled/timed out —
"Do not calculate revenue from payment attempts" was explicit in the
brief for this phase, and it's enforced structurally here, not just by
convention. GTV = `sum(subtotal)` (value of goods actually sold);
platform revenue = `sum(platform_fee)` (commission actually earned).
Delivery fees are pass-through and excluded from both. This is the same
definition `src/lib/data/payments.ts` (Phase 3's admin payment
reconciliation) already used — analytics didn't invent a second
definition of "revenue" that could quietly disagree with it.

`admin_top_products`/`admin_top_categories` join through `order_items`,
so a since-edited-or-deleted product still shows correctly under
`product_name_snapshot` (see the `order_items` row above) — a
`left join` on `products`/`categories` means a deleted product's sales
history isn't lost, just labeled "Uncategorized" if its category is also
gone.

New indexes for these queries: `orders(created_at)`,
`orders(delivery_county)`, `order_items(product_id)`,
`users(created_at)`, `farmer_profiles(verified_at)`,
`payments(status)` — all in `0009_analytics.sql`.

## Demo data

`scripts/seed-demo-data.ts` (`npm run seed:demo`) — deliberately **not**
a numbered file under `supabase/migrations/`, since migrations are real
schema that's always safe to run anywhere including production, and this
is sample data that must stay something a developer runs on purpose
against a dev/staging project. It creates ~10 real, loginable farmer
accounts (via the Supabase Admin API, `auth.admin.createUser` — not raw
`auth.users` inserts, to avoid depending on GoTrue's internal schema),
3 buyer accounts, and 15+ products per category, all sharing one
publicly-documented password. It's idempotent (checks for an existing
account by email and an existing product by farmer+name before
inserting) and prints a `Category | Product Count` report — see
`docs/ROADMAP.md` for whether it's actually been run, since this
environment has no live project to run it against.

It does not, and cannot, seed an admin account: `handle_new_user()`
coerces any requested `'admin'` role to `'buyer'` regardless of who
creates the `auth.users` row, and `guard_user_self_update()` then blocks
a role change to `'admin'` from anything but an authenticated admin
session (`is_admin()` checks `auth.uid()`, which is null for the
service-role connection the script itself uses) — both deliberately, per
`docs/SECURITY.md`'s "admin accounts are created directly against the
database." The script prints the one-line SQL an operator runs by hand
afterward to promote one demo account.

## Storage

Three public-read buckets (`supabase/migrations/0004_storage.sql`):
`product-images`, `farmer-images`, `profile-images`. Upload policies
require the object path to be prefixed with the uploader's own
`auth.uid()`. File type/size are also constrained at the bucket level
(`allowed_mime_types`, `file_size_limit`) and must additionally be
validated in application code before upload — bucket-level MIME
allow-lists are a backstop, not a substitute for real validation.
