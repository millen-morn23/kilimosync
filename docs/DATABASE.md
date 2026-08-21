# Database

Schema lives in `supabase/migrations/*.sql`, applied in filename order.
`src/lib/supabase/types.ts` is a hand-maintained mirror for TypeScript —
regenerate it from the live project once one exists (see `CLAUDE.md`).

## Entities

| Table | Purpose | Key notes |
|---|---|---|
| `users` | Profile extending `auth.users` (1:1) | Created by the `handle_new_user` trigger on signup, never by client insert. `role` and `is_suspended` can only be changed by an admin (`guard_user_self_update` trigger) — not just an RLS policy, so even a service-role misuse in application code would need to explicitly override, not accidentally slip through. |
| `farmer_profiles` | Storefront data for a farmer | Public read (farm name/county/verification are storefront info). `verification_status`/`verified_at`/`verified_by` are admin-only writes, enforced by `guard_farmer_verification_update` trigger. |
| `categories` | Product taxonomy | Public read, admin write. Seeded once in `0003_seed_categories.sql` — taxonomy, not sample listings. |
| `products` | Farmer listings | `status='active'` is publicly visible; other statuses only to the owning farmer/admin. |
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
`REFUNDED` has no code path yet (no refund flow exists).

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

## Storage

Three public-read buckets (`supabase/migrations/0004_storage.sql`):
`product-images`, `farmer-images`, `profile-images`. Upload policies
require the object path to be prefixed with the uploader's own
`auth.uid()`. File type/size are also constrained at the bucket level
(`allowed_mime_types`, `file_size_limit`) and must additionally be
validated in application code before upload — bucket-level MIME
allow-lists are a backstop, not a substitute for real validation.
