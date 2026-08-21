# Testing

## Current status

No automated test suite exists in this repository yet — it's specified
here so it lands correctly once a test runner is added, rather than being
retrofitted. `npm run build` and `npm run lint` are the only checks that
currently run (see `CLAUDE.md`). This is a real gap, not a hidden one:
**no test in this document has been executed against this codebase.**

## Phase 5.5 regression review — what "verified" means here

With no live Supabase/Daraja/Anthropic credentials available, "regression
testing" for this phase meant a code-level review — re-reading each area
against its own RLS policies, guard triggers, and server actions — plus
`npm run build`/`npm run lint` and Playwright screenshots of every page
reachable without authentication (landing, marketplace, login, signup,
404, and a temporary standalone preview route for the new chart
component, deleted before commit). It did **not** mean clicking through
a running app with a real account, because no account can exist without
a live project. Treat every "verified" below as "reviewed and reasoned
through," not "exercised end-to-end" — the distinction matters and this
document doesn't blur it.

One real bug came out of this pass, not zero: `products.slug` was
`unique(farmer_id, slug)`, but the product detail page looks a product up
by slug with no farmer in the URL — two farmers naming a product the same
thing would have collided. Fixed in `0010_global_product_slugs.sql`
before the demo-seed script (which deliberately creates exactly that
scenario — the same crop name across multiple farmers) could ever trigger
it live. See `docs/DATABASE.md`.

Two icon-only quantity-stepper buttons (`add-to-cart-form.tsx`,
`cart-line-item.tsx`) had no `aria-label` — a screen reader would announce
just "button." Fixed.

## Planned suites

### Unit

- Pricing/fee math (once checkout exists): subtotal, `platform_fee`
  derived from `platform_settings.platform_fee_percent`, total.
- Zod schemas in `src/lib/validation/`: valid/invalid Kenyan phone
  numbers, password confirmation mismatch, county required, `mainCrops`
  comma-splitting.
- Order/payment status transition guards, now that the checkout/callback
  logic in `docs/M-PESA.md` is built (`supabase/migrations/0006_mpesa.sql`)
  — invalid transitions must be rejected, e.g. `PENDING_PAYMENT →
  COMPLETED` without passing through `PAID`/`CONFIRMED`. These are SQL
  functions, so this suite needs `pgTAP` or an equivalent Postgres-level
  test runner, not a JS unit test.

### Integration

- Sign up as buyer/farmer → session persists → protected route redirects
  correctly for the wrong role (`/admin` as a buyer → redirected to
  `/dashboard`).
- Farmer without a `farmer_profiles` row sees the creation form; after
  submitting, sees their profile with `pending` status.
- Admin sees a newly-created farmer in the verification queue; verifying
  updates `verification_status`, writes an `audit_logs` row, and creates a
  `notifications` row for the farmer.
- Cart/checkout/order integration tests (Phase 2, built, not yet
  executed).
- M-PESA: `initiatePayment` rejects a phone number that doesn't match a
  Kenyan mobile pattern; rejects retrying an already-`PAID` order; rejects
  a second concurrent attempt on an order already `STK_SENT`.

### Security (RLS) — must run against a live Supabase project

These are negative-path tests: each must **fail**.

1. Buyer A can read buyer B's `orders` row.
2. Buyer A can read buyer B's `payments` row.
3. Farmer A can `UPDATE` farmer B's `products` row.
4. Farmer A can read farmer B's `payments` (farmers should never see
   payments at all).
5. A non-admin can `UPDATE` their own `users.role` to `'admin'`.
6. A non-admin can `UPDATE` a `farmer_profiles.verification_status`.
7. A non-admin can `SELECT` from `audit_logs`.
8. An authenticated user with no order can `INSERT` a `reviews` row
   referencing someone else's `order_items.id`.
9. A buyer can `INSERT` a `disputes` row for an order that isn't theirs.
10. An anonymous (unauthenticated) request can call
    `public.deduct_product_inventory(...)` (should fail — `REVOKE EXECUTE`
    in `0001_init.sql`).
11. An authenticated buyer (anon-key client, not service role) can call
    `public.record_stk_initiation(...)`, `public.confirm_mpesa_payment(...)`,
    or `public.fail_mpesa_payment(...)` directly (should fail — `REVOKE
    EXECUTE` in `0006_mpesa.sql`; these are service-role-only).
12. A `POST` to `/api/mpesa/callback` without the correct `?token=`
    (`MPESA_CALLBACK_SECRET`) is processed (should be rejected with 401).
13. A non-admin can `SELECT` from `ai_usage_logs` (should fail —
    `ai_usage_logs_admin_select` in `0007_ai.sql`).
14. Farmer A (of order O) can set `orders.order_status` on O directly to
    `DELIVERED` or `COMPLETED` (should fail — only `CONFIRMED →
    PREPARING → READY_FOR_DELIVERY` is legal for a farmer;
    `guard_order_status_update()` in `0008_orders_lifecycle.sql`).
15. Farmer A (of order O) can, in the same `UPDATE`, change
    `order_status` to a legal value *and* change `orders.total_amount`
    (should fail entirely — the trigger rejects any column change beyond
    `order_status`, not just the illegal ones).
16. Farmer B (not on order O) can `UPDATE` O's `order_status` at all
    (should fail — `orders_update_farmer_of_order` policy's `USING`
    clause, before the trigger even runs).
17. **Positive-path, not negative:** a successful `confirm_mpesa_payment()`
    call (via the service-role client, as the M-PESA callback route
    would call it) still correctly sets `order_status = 'CONFIRMED'`.
    This one must **pass** — it's the regression test for the
    `session_user = 'service_role'` bypass in
    `guard_order_status_update()` (see `docs/DATABASE.md` §Row Level
    Security). Get this wrong and Phase 3 payments silently stop
    confirming orders while still charging the buyer.
18. An anonymous (unauthenticated) request can call any `admin_*`
    analytics function (should fail — `REVOKE EXECUTE ... FROM anon` in
    `0009_analytics.sql`).
19. **Positive-path:** a non-admin *authenticated* user (buyer or farmer)
    calling an `admin_*` analytics function does **not** error — it
    returns near-empty/zero aggregates, since these functions are
    `security invoker` by design (unlike the M-PESA functions) and rely
    on each underlying table's own RLS, not a revoke, to keep the result
    meaningless for a non-admin. Confirms the two different security
    models (M-PESA's `security definer` + revoke vs. analytics'
    `security invoker`) both actually hold.
20. Two different farmers each create a product whose name slugifies
    identically (e.g. both list "Tomatoes"). Both inserts succeed with
    *different* slugs, and `/marketplace/<first-slug>` and
    `/marketplace/<second-slug>` each resolve to the correct farmer's
    listing — the regression test for the `products_slug_key` fix
    (`0010_global_product_slugs.sql`). This is exactly the scenario
    `scripts/seed-demo-data.ts` creates on purpose (many farmers selling
    the same staple crops), so running that script is itself a decent
    smoke test for this fix.

Each should be written as: authenticate as the "attacker" role via the
Supabase JS client (anon key + password), attempt the operation, assert
it's rejected by RLS (empty result set for `SELECT`, error for
`INSERT`/`UPDATE`).

### End-to-end

- **Farmer:** sign up → email confirm → create farm profile (admin gets a
  new-farmer-signup notification) → create product listing (Phase 2) →
  receive order (Phase 3; gets a new-order + low-stock notification if
  applicable) → mark preparing → mark ready for delivery (Phase 5; buyer
  gets a notification at each step).
- **Buyer:** sign up → browse (Phase 2) → add to cart (Phase 2) →
  checkout (Phase 2) → M-PESA STK push (Phase 3) → order confirmed
  (Phase 3, gets a payment-successful + order-confirmed notification) →
  admin marks out for delivery → delivered → completed (Phase 5) → rate
  the product → optionally open a dispute instead and see it resolved by
  an admin.

## M-PESA test plan (Phase 3 — built, not yet run against sandbox)

STK push, callback handling, and inventory deduction are implemented
(`src/lib/mpesa/`, `src/lib/actions/mpesa.ts`,
`src/app/api/mpesa/callback/route.ts`,
`supabase/migrations/0006_mpesa.sql`). **None of the cases below have
been executed** — this environment has no Daraja sandbox credentials and
no live Supabase project to receive the callback, so nothing here can be
claimed as passing yet (see `CLAUDE.md` rule 5). Once sandbox credentials
and a public callback URL (e.g. via `ngrok` in development) exist:

Successful STK payment, user cancellation, insufficient funds, invalid
phone number, STK timeout, valid callback, duplicate callback for the
same `checkout_request_id` (must not double-process — assert
`confirm_mpesa_payment`/`fail_mpesa_payment` returns `'already_processed'`
on the second call), callback for an unknown `checkout_request_id` (must
be rejected, not silently accepted), retry after a failed payment,
checkout attempt against an already-`PAID` order (must be rejected by
`initiatePayment`'s `RETRYABLE_STATUSES` check), two concurrent
`initiatePayment` calls on the same order (the second must be rejected by
`record_stk_initiation`'s row lock, not create a second STK push), and an
oversold order at callback time (assert `order_status` becomes
`DISPUTED`, not silently `CONFIRMED` — see `docs/ARCHITECTURE.md`
§Inventory concurrency). No test may mark a payment successful without a
callback payload matching Safaricom's actual response shape — never
simulate success by directly setting `payments.status = 'PAID'` in a test
that's meant to validate the callback handler itself.

## AI test plan (Phase 4 — built, never run against a live provider)

`src/lib/ai/` and `/api/ai/chat` are implemented but no request has ever
reached Claude — this environment has no `ANTHROPIC_API_KEY`. Before this
phase can be called done:

- Each tool in `docs/AI.md`'s table, called as its intended role, returns
  real data matching what that role's own dashboard pages show — not a
  plausible-sounding approximation.
- A buyer asking about another buyer's order gets no data (no tool
  accepts an id for this — confirm the model can't work around that by,
  say, asking `get_user_orders` with a crafted argument, since that tool
  takes no arguments at all).
- A farmer's `create_product_draft` request never results in a row in
  `products` — only a draft object returned to the chat, pre-filling
  `/dashboard/farmer/products/new` for the farmer to submit themselves.
- An admin's `get_platform_analytics` numbers match what `/admin` itself
  shows for the same moment.
- A buyer or farmer asking an admin-scoped question ("how many farmers
  are pending verification") gets a clear "I can't help with that" rather
  than the model attempting to call a tool it wasn't given.
- Sending 9 messages inside 60 seconds as one user: the 9th is rejected
  with 429, not silently queued or dropped.
- A message over 1000 characters, or a request with more than 20 history
  messages, is rejected by the Zod schema in `/api/ai/chat` before
  reaching the model.
- With `ANTHROPIC_API_KEY` unset or invalid, the chat UI shows the
  generic "temporarily unavailable" message — never a raw provider error
  or a stack trace.
- Every request above produces exactly one `ai_usage_logs` row, readable
  by an admin and by no one else (see RLS test 13 above).

## Before declaring any feature "done"

Ask, per `CLAUDE.md`: does it actually work (tested, not assumed)? Is it
authorized correctly (RLS test, not just "the UI hides the button")? Does
it handle empty/error/loading states? Does it handle concurrent actions
where relevant (inventory)? Does it work on a small mobile viewport?
