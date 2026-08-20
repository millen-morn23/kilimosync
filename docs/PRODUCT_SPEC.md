# Product Spec

## Product

**KilimoSync** — "Kilimo" (agriculture) + "Sync" (connecting farmers,
buyers, and eventually logistics). A two-sided agricultural marketplace
for Kenya: farmers ↔ buyers, with transporters, agents, and B2B buyers
architected for but not built in the MVP.

**Vision:** From Kenyan farms to your table.
**Mission:** Use technology, digital payments, AI and eventually logistics
to improve the agricultural supply chain.

## Problem

Farmers: broker dependence, low farm-gate prices, limited urban market
access, unpredictable demand, produce wastage, difficult logistics.

Buyers: high produce prices, limited farmer visibility, inconsistent
supply, limited price transparency.

## MVP objectives (definition of "proven," not "done")

1. Farmers are willing to join.
2. Farmers can successfully list produce.
3. Buyers can discover produce.
4. Buyers can purchase produce.
5. Buyers can pay through M-PESA.
6. Farmers can receive and manage orders.
7. The platform can track transactions.
8. The platform can generate revenue through transaction fees.
9. Users find the experience trustworthy and easy to use.

Status against each objective: see `docs/ROADMAP.md`. As of this commit,
objective 1 has a real (not fabricated) foundation — signup, farm profile
creation, and admin verification all work end-to-end against the schema.
Objectives 2–8 require Phases 2–4.

## Brand

- Primary `#166534` (deep agricultural green), Secondary `#22C55E` (fresh
  green), Background `#FFFFFF`, Accent `#F5F5DC` (soft beige). Centrally
  defined as CSS variables in `src/app/globals.css` — do not hardcode
  colors elsewhere.
- Logo: `src/components/brand/logo-mark.tsx` — a leaf split into two
  synced halves (deep green / fresh green) meeting at one vein, with a
  small node standing in for "sync." Also used as the favicon
  (`src/app/icon.svg`). This is an original SVG mark, not a generated or
  stock image — deliberately simple so it holds up at favicon size.

## Roles

- `buyer`, `farmer` — selectable at signup.
- `admin` — never selectable at signup (enforced in the database trigger,
  not just the UI). Created directly in the database/Supabase dashboard.
- Reserved for later phases without a schema rework: `transporter`,
  `agent`. See `docs/ROADMAP.md` §Phase 6.

## Landing page

Implemented in `src/app/page.tsx` via `src/components/marketing/*`: Hero,
Problem/Solution, How It Works, For Farmers, For Buyers, Featured Produce
(real data with an honest empty state — never fabricated listings),
Farmer Verification, M-PESA Payments, AI-powered Marketplace, Why
KilimoSync, Testimonials (explicitly labeled as pre-launch placeholders —
see the comment in `src/components/marketing/testimonials.tsx`), FAQ,
Final CTA, Footer.

No invented statistics anywhere on the site.

## Out of scope for MVP (architected for, not built)

Transporters, agricultural agents, B2B/wholesale buyers (restaurants,
hotels, schools), bulk/recurring orders, premium farmer accounts, featured
listings. The schema's `deliveries.transporter_id` and the `user_role` /
future role model are designed so these can be added without a schema
rewrite — see `docs/DATABASE.md` and `docs/ROADMAP.md`.
