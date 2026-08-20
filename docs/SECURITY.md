# Security

## Principles

1. Authorization is enforced at the data layer (Postgres RLS), not just
   hidden in the frontend. Every protected route also re-checks the
   user's role server-side before rendering (`getCurrentUser()` +
   redirect), but that's defense-in-depth, not the primary control.
2. Secrets are server-only. `NEXT_PUBLIC_*` env vars are public by
   definition; the Supabase service-role key, M-PESA credentials and AI
   provider keys never carry that prefix. `src/lib/supabase/admin.ts`
   imports `server-only`, which fails the build if it's ever pulled into
   client code.
3. Client input is never trusted, including computed totals. Every
   mutation re-validates with the Zod schema in `src/lib/validation/**`
   server-side, even though the same schema also runs client-side for UX.

## Authorization matrix (implemented)

| Actor | Can access |
|---|---|
| Buyer | Own `users` row, own `carts`/`cart_items`, orders where `buyer_id = self`, own `payments`, own `notifications`, can insert a `review` only for their own `COMPLETED` order item, can insert a `dispute` only for their own order. |
| Farmer | Own `users` row, own `farmer_profiles` row (verification fields excluded — admin only), own `products` (all statuses) + others' `active` products, orders/`order_items` that include one of their products, **not** `payments` (financial data stays buyer/admin only). |
| Admin | Everything, via `is_admin()` in every policy; role/suspension changes on `users` and verification changes on `farmer_profiles` are additionally guarded by BEFORE UPDATE triggers so they can't slip through even from a bug in application code. |

Negative-path tests for this matrix (buyer reading another buyer's order,
farmer editing another farmer's product, non-admin reading `audit_logs`,
etc.) are specified in `docs/TESTING.md`. They must be run — and pass —
against a live Supabase project before launch; that hasn't happened yet in
this environment because no live project is connected.

## Signup / role assignment

Public sign-up only ever produces `buyer` or `farmer` (`signUpSchema` in
`src/lib/validation/auth.ts` restricts the enum at the type level, and the
`handle_new_user` Postgres trigger independently coerces any other
requested role to `buyer` — so even a crafted signup payload can't create
an admin). Admin accounts are created directly against the database.

## Validation

Every form has a Zod schema in `src/lib/validation/` used by both the
client form (`zodResolver`) and the server action that receives it
(`schema.safeParse`) — so client-side validation is a UX nicety, never the
actual gate. Kenyan phone numbers are validated against
`^(?:\+254|254|0)(7|1)\d{8}$`.

## File uploads

Not yet implemented (Phase 2 — product image upload). Storage buckets and
their RLS policies already exist (`supabase/migrations/0004_storage.sql`)
with path-ownership and MIME/size constraints; the upload UI and
additional server-side validation (real content-type sniffing, not just
trusting the extension) still need to be built — tracked in
`docs/ROADMAP.md`.

## Known gaps (Phase 1)

- No rate limiting implemented yet anywhere (auth endpoints, future AI
  endpoints). Needed before production launch — see `docs/ROADMAP.md`.
- No automated RLS test suite has been run — see `docs/TESTING.md`
  §Security tests for what needs to run once a Supabase project exists.
- M-PESA and AI security sections (`docs/M-PESA.md`, `docs/AI.md`) cover
  their respective integrations, which are not yet built.
