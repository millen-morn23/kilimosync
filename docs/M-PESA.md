# M-PESA (Safaricom Daraja)

**Status: implemented, not yet run against sandbox.** All the code below
exists in this repository (`src/lib/mpesa/`, `src/lib/actions/mpesa.ts`,
`src/app/api/mpesa/callback/route.ts`,
`supabase/migrations/0006_mpesa.sql`) and passes `npm run build`/`npm run
lint`, but this environment has no Daraja sandbox credentials and no live
Supabase project, so **the flow has not been exercised end-to-end and
nothing here is claimed as tested** — see `docs/TESTING.md` §M-PESA test
plan for exactly what still needs to run once sandbox credentials exist.

## Environment variables (already reserved in `.env.example`)

```
MPESA_ENVIRONMENT=sandbox   # sandbox | production — never mixed
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_PASSKEY=
MPESA_SHORTCODE=
MPESA_CALLBACK_URL=          # include ?token=<MPESA_CALLBACK_SECRET>
MPESA_CALLBACK_SECRET=       # shared secret the callback route checks
```

All of the above are server-only. None may ever be prefixed
`NEXT_PUBLIC_`. Development and testing use sandbox credentials from
https://developer.safaricom.co.ke/ exclusively; production credentials are
configured only after the sandbox flow has been fully tested (see
`docs/TESTING.md` §M-PESA test plan) and only in the production
environment's secrets, never checked into git. In local development, the
callback URL needs to be reachable from the internet (e.g. `ngrok http
3000`) since Safaricom's sandbox calls back over HTTPS to a real host.

## Required flow

1. Buyer completes checkout (Phase 2, `src/lib/actions/checkout.ts`).
   Server validates the order and recomputes the total server-side — the
   client-submitted total is never trusted. Order is created with
   `payment_status = 'PENDING'`, `order_status = 'PENDING_PAYMENT'`. No
   inventory is deducted yet.
2. On the order page, the buyer enters/confirms an M-PESA phone number and
   submits `initiatePayment(orderId, phone)`
   (`src/lib/actions/mpesa.ts`). This re-reads `orders.total_amount` from
   the database — the amount is never taken from the client — checks the
   order is in a retryable state (`PENDING`/`FAILED`/`CANCELLED`/`TIMEOUT`;
   rejects if already `STK_SENT`/`PAID`), then calls Daraja
   (`src/lib/mpesa/client.ts`) using a Postgres-generated `orders.id`
   (truncated to 12 chars) as the `AccountReference`.
3. On success, `record_stk_initiation()`
   (`supabase/migrations/0006_mpesa.sql`) atomically inserts the
   `payments` row (`status = 'STK_SENT'`, `merchant_request_id`,
   `checkout_request_id` — unique, so a retry can't create a duplicate)
   and sets `orders.payment_status = 'STK_SENT'`, row-locking the order
   first so two near-simultaneous "Pay now" clicks can't both succeed.
4. UI shows "Check your phone" (`src/components/checkout/pay-with-mpesa.tsx`)
   and polls `getOrderPaymentStatus()` every 3s for up to 90s — this state
   must never be treated as payment success on its own.
5. Safaricom calls back to `MPESA_CALLBACK_URL`
   (`src/app/api/mpesa/callback/route.ts`). The handler:
   - Rejects the request with 401 if `?token=` doesn't match
     `MPESA_CALLBACK_SECRET` — Daraja 3.0 doesn't sign callbacks, so this
     shared secret is the source check (`docs/M-PESA.md` originally called
     for an IP allow-list too; not implemented, since this environment has
     no fixed egress IPs to allow-list against — the secret token is the
     enforced boundary).
   - Always responds `200 {"ResultCode": 0, "ResultDesc": "Accepted"}` so
     Safaricom stops retrying, even when the callback body itself can't be
     matched to a known payment (logged as an `audit_logs` row instead).
   - Is idempotent: `confirm_mpesa_payment()`/`fail_mpesa_payment()`
     row-lock the matched `payments` row and return `'already_processed'`
     without reprocessing if its status is already terminal (`PAID`,
     `FAILED`, `CANCELLED`, `TIMEOUT`) — duplicate-callback protection.
   - On `ResultCode = 0`: `confirm_mpesa_payment()` sets
     `payments.status = 'PAID'`, stores `mpesa_receipt_number`,
     `result_code`, `result_description`, `raw_callback`, `completed_at`;
     sets `orders.payment_status = 'PAID'` and
     `orders.order_status = 'CONFIRMED'`; calls
     `deduct_product_inventory()` for each order item, all inside one
     function call (one transaction). If a deduction fails (oversold
     between checkout and callback — see `docs/ARCHITECTURE.md`
     §Inventory concurrency), `order_status` becomes `DISPUTED` instead
     and an `audit_logs` row is written for manual admin
     reconciliation/refund — the payment is never silently dropped, since
     Safaricom has already moved real money.
   - On any non-zero `ResultCode` (cancelled, insufficient funds, timeout,
     wrong PIN, etc.): `fail_mpesa_payment()` sets `payments.status` to
     the matching value (`FAILED`/`CANCELLED`/`TIMEOUT`, mapped in
     `mapResultCodeToStatus()`), leaves `orders.order_status` at
     `PENDING_PAYMENT`, and inventory is untouched. The buyer can retry
     from the same order page.
   - Both functions run as `service_role` — `REVOKE EXECUTE ... FROM
     public, anon, authenticated` in `0006_mpesa.sql` means a buyer-scoped
     client cannot call them directly no matter what the application code
     does.

## Payment entity

`payments` (`supabase/migrations/0001_init.sql`): `id`, `order_id`,
`buyer_id`, `amount`, `phone_number`, `status`, `merchant_request_id`,
`checkout_request_id` (unique), `mpesa_receipt_number` (unique),
`result_code`, `result_description`, `raw_callback`, `created_at`,
`completed_at`.

## Error states handled

- **Invalid phone number** — rejected client- and server-side by
  `mpesaPhoneSchema` (`src/lib/validation/mpesa.ts`) before any Daraja
  call is made.
- **Order already paid / payment already in flight** — rejected by
  `initiatePayment`'s status check, with a distinct message for each
  ("This order has already been paid." vs. "A payment is already in
  progress for this order.").
- **Network failure / invalid credentials reaching Daraja** —
  `initiateStkPush()` catches both the OAuth token request and the STK
  push request; either failure returns a generic
  `{ error: "Could not reach M-PESA..." }` / `{ error: "M-PESA declined
  the payment request..." }` — never a raw Daraja error or stack trace.
- **M-PESA not configured in this environment** — `getMpesaConfig()`
  returns a typed error instead of throwing, so a deployment without
  sandbox credentials yet fails the payment attempt cleanly rather than
  crashing the order page.
- **STK timeout, user cancellation, insufficient funds, wrong PIN** —
  all arrive as callback `ResultCode` values, mapped by
  `mapResultCodeToStatus()` to `TIMEOUT`/`CANCELLED`/`FAILED` and surfaced
  on the order page with a specific message per status
  (`src/app/orders/[id]/page.tsx`).
- **Callback signature/format failure** — `parseStkCallback()` returns
  `null` for a body that doesn't match Daraja's shape; the route logs it
  to `audit_logs` and still acks 200 (Safaricom would otherwise retry a
  callback it will keep sending in the same malformed shape).
- **Duplicate callback / callback for an unknown `checkout_request_id`** —
  see the idempotency behavior in `confirm_mpesa_payment()`/
  `fail_mpesa_payment()` above; both are logged distinctly to
  `audit_logs` when unmatched.

User-facing messages are generic and helpful throughout ("Payment could
not be completed — please try again") — Daraja error codes and internal
state are never exposed to the buyer.

## Reconciliation

`/admin/payments` (`src/app/admin/payments/page.tsx`,
`src/lib/data/payments.ts`) — successful/pending/failed counts, gross
transaction value, and a list of every payment with its phone number,
amount, status, and (once confirmed) M-PESA receipt number, most recent
first. Also summarized on `/admin` itself. Reads through the
RLS-respecting client — `payments_select_buyer_or_admin` is what actually
restricts this to admins, not the page. Never fabricates a receipt
number: `mpesa_receipt_number` is `null` until Safaricom's callback sets
it.

## Platform fee

`platform_settings.platform_fee_percent` (default 5.00, admin-editable —
`supabase/migrations/0001_init.sql`). The fee is computed server-side at
checkout time from this table, never hardcoded in a component and never
trusted from the client.
