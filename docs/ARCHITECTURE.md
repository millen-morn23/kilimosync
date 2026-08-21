# Architecture

## Stack decision

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | Next.js 16 (App Router), TypeScript | SSR/SEO for public marketplace + product pages, Route Handlers double as a lightweight API layer for M-PESA callbacks and AI tool endpoints, deploys cleanly to Vercel. A plain Vite SPA was considered but rejected — the marketplace and product pages need server-rendered metadata (see `docs/PRODUCT_SPEC.md` §SEO). |
| Styling | Tailwind CSS v4 (CSS-first config) | Design tokens live in `src/app/globals.css` as CSS variables, centrally controlling the brand palette (§9 of the product spec). |
| Components | Hand-authored shadcn-style primitives (`src/components/ui`) on Radix UI primitives | The `shadcn` CLI's hosted registry was unreachable from this environment during scaffolding; the components were authored directly using the same conventions (CVA variants, Radix primitives, `cn()` helper) so `npx shadcn@latest add <component>` still works going forward. |
| Backend | Supabase (Postgres, Auth, Storage, RLS) | Matches the product brief; Postgres RLS gives us real, server-enforced authorization instead of ad-hoc API checks. |
| Payments | Safaricom Daraja (M-PESA) | Required by the brief. Sandbox-first (see `docs/M-PESA.md`). |
| AI | Server-side tool-calling layer (provider-agnostic interface) | Keeps API keys server-only and gives the AI a fixed, auditable set of tools instead of raw DB access (see `docs/AI.md`). |
| Hosting | Vercel (app) + Supabase (data) | Matches the product brief. |

## Repository history note

This repository (`millen-morn23/kilimosync`) was created empty specifically
for this project — there was no prior codebase to evaluate or migrate. A
separate repository (`expenditure-journal`) exists with an unrelated static
personal-finance app; it was not touched.

## Layered structure

```
Presentation        src/app/**/page.tsx, src/components/**
Application logic   src/lib/actions/**  ("use server" — the only layer
                     allowed to call src/lib/supabase/admin.ts)
Domain validation    src/lib/validation/** (Zod — shared by client forms
                     and server actions, so server-side validation is
                     never skipped)
Data access          src/lib/supabase/{client,server}.ts (RLS-respecting)
                     src/lib/data/** (typed read helpers)
External integrations src/lib/mpesa/** (planned), src/lib/ai/** (planned)
```

Each external integration (M-PESA, AI provider, future SMS/email) gets its
own module boundary under `src/lib/` so the provider can be swapped without
touching call sites — see `docs/ROADMAP.md` for what's implemented per
phase.

## Request flow (authenticated page)

1. `src/proxy.ts` (Next.js 16's Proxy — the renamed Middleware convention) refreshes the Supabase session cookie and redirects
   unauthenticated requests away from `/dashboard` and `/admin`.
2. The page's Server Component calls `src/lib/data/current-user.ts`, which
   uses the RLS-respecting server client — so even if middleware were
   bypassed, Postgres itself would refuse to return another user's row.
3. Mutations go through a Server Action in `src/lib/actions/**`, which
   re-validates input with the same Zod schema the client form used, then
   writes through the RLS-respecting client. Only a handful of writes
   (audit logs, notifications, M-PESA callback processing) use the
   service-role client in `src/lib/supabase/admin.ts`, and only after the
   caller's privilege has already been confirmed via the RLS-respecting
   client in the same action — see `src/lib/actions/admin.ts` for the
   pattern.

## Inventory concurrency

Two buyers can attempt to buy from the same finite stock at the same time.
`public.deduct_product_inventory(product_id, quantity)` (in
`supabase/migrations/0001_init.sql`) performs a single guarded `UPDATE …
WHERE quantity_available >= quantity`, which Postgres executes atomically
under row-level locking — the second concurrent caller's `WHERE` clause
simply fails once the first has committed. This function is intentionally
not exposed to the anon/authenticated roles (`REVOKE EXECUTE`); it is only
ever invoked from inside `confirm_mpesa_payment()`
(`supabase/migrations/0006_mpesa.sql`), itself only callable by the
service-role client from the M-PESA callback handler, after payment is
confirmed `PAID` — never at checkout, and never from client code.

**Known limitation (implemented as designed, not a bug):** between order
creation (`PENDING_PAYMENT`) and STK callback, stock is not "held." If two
buyers both complete payment for the last unit, the first deduction wins
and the second fails safely (inventory never goes negative), but the
second buyer's M-PESA payment has already succeeded.
`confirm_mpesa_payment()` handles exactly this: it sets `order_status =
'DISPUTED'` instead of `'CONFIRMED'` and writes an `audit_logs` row for
manual admin refund, rather than silently dropping the mismatch. A
short-lived inventory hold at STK-push time — so this case becomes rarer,
not just handled — is the longer-term fix and is tracked in
`docs/ROADMAP.md`.

## What's implemented vs. planned

See `docs/ROADMAP.md` for the phase-by-phase breakdown. As of this
commit, Phases 1–5 are implemented — branding, schema, RLS, auth, farmer
verification, marketing site, farmer product CRUD with image upload,
marketplace search/filters, cart, checkout, M-PESA STK push and callback
handling with atomic inventory deduction, admin payment reconciliation,
KilimoSync AI (tool-calling chat for buyer/farmer/admin), and order
lifecycle operations (farmer/admin status progression, real notifications
across every role, reviews, disputes). Phases 3 and 4 are code-complete
but unexercised against a real backend — no Daraja sandbox, live Supabase
project, or Anthropic API key exists in this environment, so neither a
real payment nor a real AI conversation has happened yet; Phase 5's new
RLS policy and trigger (`0008_orders_lifecycle.sql`) are unverified for
the same reason. See `docs/ROADMAP.md` for exactly what each phase needs
before being called done. Platform-wide admin analytics and Phase 6
(transporter/agent/B2B expansion) are not built.
