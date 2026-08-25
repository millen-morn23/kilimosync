# Security

## Principles

1. Authorization is enforced at the data layer (Postgres RLS), not just
   hidden in the frontend. Every protected route also re-checks the
   user's role server-side before rendering (`getCurrentUser()` +
   redirect), but that's defense-in-depth, not the primary control.
2. Secrets are server-only. `NEXT_PUBLIC_*` env vars are public by
   definition; the Supabase service-role key, M-PESA credentials and the
   `ANTHROPIC_API_KEY` never carry that prefix. `src/lib/supabase/admin.ts`
   and `src/lib/mpesa/*`/`src/lib/ai/*` import `server-only`, which fails
   the build if any of them are ever pulled into client code.
3. Client input is never trusted, including computed totals. Every
   mutation re-validates with the Zod schema in `src/lib/validation/**`
   server-side, even though the same schema also runs client-side for UX.
4. Column- and transition-level rules that RLS's row-level model can't
   express (a farmer may change `orders.order_status` but nothing else on
   that row, and only along specific transitions) are enforced by `BEFORE
   UPDATE` triggers, not left to application code — see
   `guard_order_status_update()` in `0008_orders_lifecycle.sql`.

## Authorization matrix (implemented)

| Actor | Can access |
|---|---|
| Buyer | Own `users` row, own `carts`/`cart_items`, orders where `buyer_id = self` (insert via checkout, no direct update), own `payments` (read-only — written only by the M-PESA integration), own `notifications`, can insert a `review` only for their own `COMPLETED` order item, can insert a `dispute` only for their own order. |
| Farmer | Own `users` row, own `farmer_profiles` row (verification fields excluded — admin only), own `products` (all statuses) + others' `active` products, orders/`order_items` that include one of their products (read), and — as of Phase 5 — can update `order_status` (only) on those same orders, restricted to `CONFIRMED → PREPARING → READY_FOR_DELIVERY` by `guard_order_status_update()`; **not** `payments` (financial data stays buyer/admin only). |
| Admin | Everything, via `is_admin()` in every policy; role/suspension changes on `users`, verification changes on `farmer_profiles`, and (unlike a farmer) any `orders` column/status are additionally guarded or explicitly allowed by triggers/policies so they can't slip through even from a bug in application code. |

Negative-path tests for this matrix (buyer reading another buyer's order,
farmer editing another farmer's product, non-admin reading `audit_logs`,
etc.) are specified in `docs/TESTING.md`. They must be run — and pass —
against a live Supabase project before launch; that hasn't happened yet in
this environment because no live project is connected.

## Server-role writes: who can call what

Several write paths intentionally bypass the RLS-respecting client and go
through `src/lib/supabase/admin.ts` (service role) instead — always *after*
the caller's identity/role has already been confirmed via the
RLS-respecting client in the same server action, never as a substitute for
that check:

- `audit_logs`, `notifications` — no client insert policy exists for any
  role; every notification in the app (payment result, order status
  change, new order, low stock, new farmer signup, dispute opened/resolved)
  is written this way, either directly or via the `notify_order_status_change`
  trigger, which is not RLS-gated at all (it's DB-internal).
- `payments`/`orders.payment_status` — exclusively through
  `record_stk_initiation()`/`confirm_mpesa_payment()`/`fail_mpesa_payment()`
  (`0006_mpesa.sql`), `REVOKE`d from `public`/`anon`/`authenticated`,
  `GRANT`ed only to `service_role`. See `docs/M-PESA.md`.
- `ai_usage_logs` — written by `/api/ai/chat` after the request is fully
  processed, admin-read-only. See `docs/AI.md`.

## Signup / role assignment

Public sign-up only ever produces `buyer` or `farmer` (`signUpSchema` in
`src/lib/validation/auth.ts` restricts the enum at the type level, and the
`handle_new_user` Postgres trigger independently coerces any other
requested role to `buyer` — so even a crafted signup payload can't create
an admin). Admin accounts are created directly against the database.

**Bootstrapping the very first admin is not a plain `UPDATE`.**
`guard_user_self_update` (`0002_rls.sql`) only allows a role change when
`public.is_admin()` is already true for the caller, and that function
reads `auth.uid()` — which is null for a raw psql/direct-Postgres session
and for the `service_role` API client alike, since neither carries a real
Supabase Auth JWT. Confirmed by testing: a `service_role` client update to
`users.role` is rejected with "Only an admin may change a user role" even
though `service_role` bypasses RLS — the trigger fires regardless of RLS.
There is no admin who can promote the first admin, by design, so a plain
`update public.users set role = 'admin' where email = '<demo-email>'`
against a fresh project will fail. To bootstrap the first admin, connect
with `SUPABASE_DB_URL` (a real Postgres superuser connection — direct
`psql`/a Postgres client, not the Supabase JS client) and disable the
trigger for the single statement:

```sql
alter table public.users disable trigger guard_user_self_update;
update public.users set role = 'admin' where email = '<demo-email>';
alter table public.users enable trigger guard_user_self_update;
```

Every admin after the first can instead be promoted from inside the app
once one exists — see the "not yet built" note in `docs/ROADMAP.md` Phase
5.5 for the still-missing admin-users UI that would make this a normal
in-app action instead of a one-time manual step.

## Validation

Every form has a Zod schema in `src/lib/validation/` used by both the
client form (`zodResolver`) and the server action that receives it
(`schema.safeParse`) — so client-side validation is a UX nicety, never the
actual gate. Kenyan phone numbers are validated against
`^(?:\+254|254|0)(7|1)\d{8}$`.

## File uploads

Implemented (Phase 2). Storage buckets and their RLS policies
(`supabase/migrations/0004_storage.sql`) enforce path-ownership
(`auth.uid()`-prefixed object paths) and bucket-level MIME/size limits.
`src/components/farmer/product-image-uploader.tsx` additionally validates
file type and size client-side before upload — a UX nicety, not the
boundary, same as every other client-side check in this app. Real
content-type sniffing (as opposed to trusting the browser-reported MIME
type) is not implemented and is a known gap for a production hardening
pass.

## Rate limiting

Implemented for the one endpoint that actually costs money per call:
`/api/ai/chat` is limited to 8 requests/minute/user, backed by counting
that user's own rows in `ai_usage_logs` (DB-backed, so it holds across
serverless instances — see `docs/AI.md`). Auth endpoints (login, signup,
password reset) have no additional rate limiting beyond whatever Supabase
Auth itself applies — a known gap for a production hardening pass.

## Known gaps

- No automated RLS test suite has been run — see `docs/TESTING.md`
  §Security tests for the full list, which now also covers the Phase
  3/4/5 additions (M-PESA functions, `ai_usage_logs`, the farmer
  order-status policy). None of it has run because no live Supabase
  project is connected to this environment.
- No real content-type sniffing on uploads (see above).
- No rate limiting on auth endpoints (see above).
- M-PESA and AI are code-complete but have never run against a real
  Daraja sandbox or Anthropic API key — see `docs/M-PESA.md` and
  `docs/AI.md` for exactly what's unverified.
