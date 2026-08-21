# Deployment

## Current status

Not deployed. No Supabase project, Vercel project, or M-PESA/AI
credentials exist for this app in this environment — this document
specifies the path so it can be executed once those exist.

## Environments

Three separate configurations, never sharing credentials:

- **Development** — local `.env.local`, Supabase local dev or a dev
  project, M-PESA sandbox.
- **Staging** — a separate Supabase project, M-PESA sandbox, used for the
  pilot cohort described in `docs/ROADMAP.md`.
- **Production** — its own Supabase project, M-PESA **production**
  credentials, real AI provider key.

Sandbox and production M-PESA credentials must never be mixed in the same
deployment.

## Steps to first deploy (staging)

1. Create a Supabase project. Run every migration in order:
   `supabase db push` (or apply each file in `supabase/migrations/` via
   the SQL editor, in filename order — check the directory rather than
   trusting a hardcoded list here to stay current as phases ship).
2. Regenerate `src/lib/supabase/types.ts` from the live schema (see
   `CLAUDE.md`).
3. Set environment variables in Vercel (Project Settings → Environment
   Variables) matching `.env.example` — `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXT_PUBLIC_SITE_URL`. Leave M-PESA/AI vars unset until those phases
   ship.
4. Connect this repository to Vercel, deploy.
5. Create the first admin manually: sign up as any role through the app,
   then update that row's `role` to `'admin'` directly in the Supabase
   SQL editor (public sign-up cannot create admins by design — see
   `docs/SECURITY.md`).
6. Smoke test: sign up as a farmer, submit a farm profile, verify it as
   the admin account, confirm the verified badge appears.
7. **Staging/dev only, never production:** `npm run seed:demo`
   (`scripts/seed-demo-data.ts`) populates ~10 loginable demo farmer
   accounts, 3 demo buyers, and 15+ real products per category — see
   `docs/DATABASE.md` §Demo data. It creates real Supabase Auth users
   with a publicly-documented shared password (`KilimoDemo123!`), which
   is exactly why this step is staging/dev-only: running it against a
   production project would be a real security issue, not just messy
   data. Nothing about it runs automatically — it's a script a developer
   runs on purpose, reading `SUPABASE_SERVICE_ROLE_KEY` from
   `.env.local`.

## Pre-production checklist (do not skip any item)

1. `npm run lint` and `npm run build` pass.
2. RLS negative-path tests (`docs/TESTING.md` §Security tests) pass
   against the target project.
3. M-PESA sandbox flow fully tested end-to-end (`docs/TESTING.md` §M-PESA
   test plan) before requesting production Daraja credentials.
4. Production M-PESA credentials configured, callback URL registered with
   Safaricom and reachable over HTTPS.
5. Production AI provider key configured, rate limiting live.
6. Terms of Service, Privacy Policy, Refund Policy pages exist and are
   linked from the footer (`src/components/marketing/site-footer.tsx`
   already links to `/legal/terms`, `/legal/privacy`, `/legal/refunds` —
   the pages themselves still need to be written; not legal advice this
   repo can generate on its own).
7. Custom domain configured — see `docs/PRODUCT_SPEC.md` note on domain
   availability; `kilimosync.com` availability has not been checked from
   this environment and must be verified before purchase.
8. Monitor after launch; start with the pilot cohort described in
   `docs/ROADMAP.md` (5–10 farmers, 10–20 buyers, one geographic area)
   before wider rollout.
