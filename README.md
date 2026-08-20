# KilimoSync

From Kenyan farms to your table. KilimoSync connects farmers directly with
buyers — fresh produce, fair pricing, M-PESA payments.

This repository is being built incrementally, phase by phase. See
[`docs/ROADMAP.md`](docs/ROADMAP.md) for what's shipped and what's next,
and [`CLAUDE.md`](CLAUDE.md) for the engineering rules this project
follows.

## Stack

Next.js (App Router) + TypeScript + Tailwind v4, Supabase (Postgres,
Auth, Storage, RLS), Safaricom M-PESA Daraja (planned), server-side AI
tool-calling (planned). See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for the full rationale.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your own Supabase project details
npm run dev
```

Without Supabase credentials configured, the marketing pages still render
(with honest empty states instead of fake data), but auth and
dashboard/admin routes require a real Supabase project — see
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for setup, including applying
`supabase/migrations/*.sql` in order.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack decisions, layering, inventory concurrency
- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) — product, brand, roles, scope
- [`docs/DATABASE.md`](docs/DATABASE.md) — schema and RLS design
- [`docs/SECURITY.md`](docs/SECURITY.md) — authorization matrix, validation
- [`docs/M-PESA.md`](docs/M-PESA.md) — payment integration spec (Phase 3)
- [`docs/AI.md`](docs/AI.md) — KilimoSync AI design (Phase 4)
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — environments, deploy steps, pre-production checklist
- [`docs/TESTING.md`](docs/TESTING.md) — test plans, including RLS negative-path tests
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phase-by-phase plan
