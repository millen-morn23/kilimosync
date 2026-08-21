# Testing

## Current status

No automated test suite exists in this repository yet — it's specified
here so it lands correctly once a test runner is added, rather than being
retrofitted. `npm run build` and `npm run lint` are the only checks that
currently run (see `CLAUDE.md`). This is a real gap, not a hidden one:
**no test in this document has been executed against this codebase.**

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

Each should be written as: authenticate as the "attacker" role via the
Supabase JS client (anon key + password), attempt the operation, assert
it's rejected by RLS (empty result set for `SELECT`, error for
`INSERT`/`UPDATE`).

### End-to-end

- **Farmer:** sign up → email confirm → create farm profile → create
  product listing (Phase 2) → receive order (Phase 3) → (Phase 5) order
  marked completed.
- **Buyer:** sign up → browse (Phase 2) → add to cart (Phase 2) →
  checkout (Phase 2) → M-PESA STK push (Phase 3) → order confirmed
  (Phase 3) → (Phase 5) order delivered/completed.

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

## Before declaring any feature "done"

Ask, per `CLAUDE.md`: does it actually work (tested, not assumed)? Is it
authorized correctly (RLS test, not just "the UI hides the button")? Does
it handle empty/error/loading states? Does it handle concurrent actions
where relevant (inventory)? Does it work on a small mobile viewport?
