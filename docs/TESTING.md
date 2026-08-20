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
- Order/payment status transition guards (once the checkout/callback
  logic in `docs/M-PESA.md` is built) — invalid transitions must be
  rejected, e.g. `PENDING_PAYMENT → COMPLETED` without passing through
  `PAID`/`CONFIRMED`.

### Integration

- Sign up as buyer/farmer → session persists → protected route redirects
  correctly for the wrong role (`/admin` as a buyer → redirected to
  `/dashboard`).
- Farmer without a `farmer_profiles` row sees the creation form; after
  submitting, sees their profile with `pending` status.
- Admin sees a newly-created farmer in the verification queue; verifying
  updates `verification_status`, writes an `audit_logs` row, and creates a
  `notifications` row for the farmer.
- Cart/checkout/order integration tests once those phases are built.

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

Each should be written as: authenticate as the "attacker" role via the
Supabase JS client (anon key + password), attempt the operation, assert
it's rejected by RLS (empty result set for `SELECT`, error for
`INSERT`/`UPDATE`).

### End-to-end

- **Farmer:** sign up → email confirm → create farm profile → (Phase 2)
  create product listing → (Phase 3) receive order → (Phase 5) order
  marked completed.
- **Buyer:** sign up → (Phase 2) browse → add to cart → (Phase 2)
  checkout → (Phase 3) M-PESA STK push → (Phase 3) order confirmed →
  (Phase 5) order delivered/completed.

## M-PESA test plan (Phase 3, sandbox only)

Successful STK payment, user cancellation, insufficient funds, invalid
phone number, STK timeout, valid callback, duplicate callback for the
same `checkout_request_id` (must not double-process), callback for an
unknown `checkout_request_id` (must be rejected, not silently accepted),
retry after a failed payment, checkout attempt against an
already-`PAID` order (must be rejected). No test may mark a payment
successful without a callback payload matching Safaricom's actual
response shape — never simulate success by directly setting
`payments.status = 'PAID'` in a test that's meant to validate the
callback handler itself.

## Before declaring any feature "done"

Ask, per `CLAUDE.md`: does it actually work (tested, not assumed)? Is it
authorized correctly (RLS test, not just "the UI hides the button")? Does
it handle empty/error/loading states? Does it handle concurrent actions
where relevant (inventory)? Does it work on a small mobile viewport?
