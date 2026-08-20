# CLAUDE.md — KilimoSync Engineering Rules

Permanent engineering rules for this repository. Read this before making
changes. See `docs/` for architecture, database, security, M-PESA, AI,
deployment, testing and roadmap detail — keep those in sync with the code
whenever architecture changes.

## What this is

KilimoSync is a two-sided Kenyan agri-marketplace (farmers ↔ buyers) with
M-PESA payments and an AI assistant. It is being built incrementally,
phase by phase — see `docs/ROADMAP.md` for what's shipped and what's next.
Never jump straight from UI generation to "production ready."

## Stack

- Next.js (App Router) + TypeScript + Tailwind v4, deployed to Vercel.
- Supabase: Postgres, Auth, Storage, Row Level Security.
- shadcn-style components under `src/components/ui` (hand-authored, Radix
  primitives) + Lucide icons.
- Safaricom M-PESA Daraja for payments (sandbox first, always).
- Server-side AI tool-calling layer (never client-side AI calls).

## Non-negotiable rules

1. **RLS is the source of truth for authorization.** Every table holding
   user- or role-scoped data must have RLS enabled with policies matching
   `docs/SECURITY.md`'s authorization matrix. Frontend route hiding is UX,
   never security.
2. **Secrets never reach the browser.** M-PESA credentials, the Supabase
   service-role key, and AI provider keys are server-only. Anything
   prefixed `NEXT_PUBLIC_` is public by definition — never put a secret
   there. `src/lib/supabase/admin.ts` uses `server-only` specifically to
   fail the build if this is violated.
3. **Never trust client input, including totals.** Prices, quantities,
   fee calculations and payment amounts are always recomputed server-side
   before being persisted or sent to M-PESA.
4. **Inventory deduction is atomic and happens exactly once, after a
   verified payment.** Use `public.deduct_product_inventory(...)` (a
   guarded Postgres function, not a plain client UPDATE) — never
   read-then-write inventory from application code.
5. **Never mark a payment successful without a verified Safaricom
   callback.** "STK push accepted" is not "payment succeeded." See
   `docs/M-PESA.md`.
6. **Never fabricate marketplace data.** No demo products, farmers,
   orders, or reviews in code that ships to production. Empty states are
   the correct way to represent "nothing here yet" — see
   `src/components/marketing/featured-produce.tsx` for the pattern.
   Placeholder content (e.g. testimonials before real customers exist)
   must be clearly labeled as a placeholder in the UI, not presented as
   real.
7. **Admin accounts are never self-service.** Public sign-up only ever
   creates `buyer` or `farmer` roles (enforced in the `handle_new_user`
   trigger and again in `signUpSchema`). Role and suspension changes on
   `public.users` require admin privileges, enforced by a database
   trigger — not just application code.
8. **Order history is immutable once written.** `order_items` snapshots
   product name and price at purchase time; never join back to `products`
   for historical pricing.
9. **Don't rewrite working code without reason, and don't build ahead of
   need.** Check `docs/ROADMAP.md` before adding a feature — if it belongs
   to a later phase, leave a clearly-labeled "coming soon" state instead of
   a half-built one.
10. **Regenerate `src/lib/supabase/types.ts` from the live schema** once a
    Supabase project is linked (`npx supabase gen types typescript
    --project-id <ref> > src/lib/supabase/types.ts`) instead of hand-editing
    it further.
11. **Run `npm run lint` and `npm run build` before considering a change
    done.** If a check fails, fix the root cause — don't silence it.
12. **Never claim a feature works without testing it**, and never claim
    M-PESA payment success without verified payment data. If something
    can't be verified in this environment (no live credentials), say so
    explicitly instead of asserting it works.

## Directory map

- `src/app` — routes (App Router). Route groups: `(auth)` for
  login/signup/forgot-password.
- `src/components/ui` — shadcn-style primitives.
- `src/components/{marketing,auth,farmer,admin,brand}` — feature UI.
- `src/lib/supabase` — `client.ts` (browser), `server.ts` (RLS-respecting,
  Server Components/Actions), `admin.ts` (service-role, narrow use only).
- `src/lib/actions` — server actions (`"use server"`), the only place
  that should call `admin.ts`.
- `src/lib/validation` — Zod schemas shared by client forms and server
  actions.
- `supabase/migrations` — the schema, in order. Never edit a merged
  migration; add a new one.

## Git workflow

Small, meaningful commits (`feat: ...`, `fix: ...`, `test: ...`), not one
giant commit per phase.
