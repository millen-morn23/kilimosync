# M-PESA (Safaricom Daraja)

**Status: not yet implemented.** This document specifies the integration
so Phase 3 can build it directly against this plan. No M-PESA code exists
in this repository yet — `docs/ROADMAP.md` tracks it as Phase 3.

## Environment variables (already reserved in `.env.example`)

```
MPESA_ENVIRONMENT=sandbox   # sandbox | production — never mixed
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_PASSKEY=
MPESA_SHORTCODE=
MPESA_CALLBACK_URL=
```

All of the above are server-only. None may ever be prefixed
`NEXT_PUBLIC_`. Development and testing use sandbox credentials from
https://developer.safaricom.co.ke/ exclusively; production credentials are
configured only after the sandbox flow has been fully tested (see
`docs/TESTING.md` §M-PESA test plan) and only in the production
environment's secrets, never checked into git.

## Required flow

1. Buyer completes checkout (Phase 2). Server validates the order and
   recomputes the total server-side — the client-submitted total is never
   trusted.
2. Order is created with `payment_status = 'PENDING'`,
   `order_status = 'PENDING_PAYMENT'`. No inventory is deducted yet.
3. Server requests an STK Push from Daraja, using a Postgres-generated
   `orders.id` as an idempotency anchor. Store `merchant_request_id` and
   `checkout_request_id` on the `payments` row immediately —
   `checkout_request_id` has a unique constraint so a retried request
   can't create a duplicate payment record.
4. UI shows "Check your phone" — this state must never be treated as
   payment success. `payment_status` moves to `STK_SENT` only.
5. Safaricom calls back to `MPESA_CALLBACK_URL` (a Route Handler, e.g.
   `src/app/api/mpesa/callback/route.ts`, not yet built). The handler:
   - Verifies the callback is well-formed and matches a known
     `checkout_request_id`.
   - Is idempotent: if the matched `payments` row is already `PAID` or
     `FAILED`, it returns success without reprocessing (duplicate
     callback protection).
   - On `ResultCode = 0`: sets `payments.status = 'PAID'`, stores
     `mpesa_receipt_number`, `result_code`, `result_description`,
     `raw_callback`, `completed_at`; sets `orders.payment_status = 'PAID'`
     and `orders.order_status = 'CONFIRMED'`; calls
     `deduct_product_inventory()` for each order item inside the same
     transaction. If a deduction fails (oversold between checkout and
     callback — see `docs/ARCHITECTURE.md` §Inventory concurrency), the
     order is marked `DISPUTED` and an `audit_logs` row is written for
     manual admin reconciliation/refund — the payment is never silently
     dropped.
   - On any non-zero `ResultCode` (cancelled, insufficient funds, timeout,
     wrong PIN, etc.): sets `payments.status` to the matching value
     (`FAILED`/`CANCELLED`/`TIMEOUT`), leaves `orders.order_status` at
     `PENDING_PAYMENT`, and inventory is untouched.
   - This entire handler runs with the service-role client
     (`src/lib/supabase/admin.ts`) — it authenticates the *request* by
     validating the callback comes from Safaricom (source IP allow-list
     and/or a shared callback secret in the URL), not via a user session.

## Payment entity

`payments` (`supabase/migrations/0001_init.sql`): `id`, `order_id`,
`buyer_id`, `amount`, `phone_number`, `status`, `merchant_request_id`,
`checkout_request_id` (unique), `mpesa_receipt_number` (unique),
`result_code`, `result_description`, `raw_callback`, `created_at`,
`completed_at`.

## Error states to handle (Phase 3, not yet built)

Invalid phone number, STK timeout, user cancellation, insufficient funds,
invalid credentials, network failure, callback signature/format failure,
duplicate callback, callback for an unknown `checkout_request_id`, and a
callback for an order that's already `PAID`. User-facing messages must be
generic and helpful ("Payment could not be completed — please try again")
— never expose Daraja error codes or internal state to the buyer.

## Reconciliation (Phase 3/5)

Admin needs a read view over `payments` joined to `orders` — successful,
failed, and pending, with receipts and identifiers. Never fabricate a
receipt number; if Safaricom hasn't confirmed a payment, it has no
receipt.

## Platform fee

`platform_settings.platform_fee_percent` (default 5.00, admin-editable —
`supabase/migrations/0001_init.sql`). The fee is computed server-side at
checkout time from this table, never hardcoded in a component and never
trusted from the client.
