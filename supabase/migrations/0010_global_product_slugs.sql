-- ─────────────────────────────────────────────────────────────────────────
-- Bug fix: product slugs must be globally unique, not per-farmer.
--
-- 0001_init.sql declared `unique (farmer_id, slug)`, but the product
-- detail route (/marketplace/[slug], src/app/marketplace/[slug]/page.tsx)
-- looks a product up by slug alone — there's no farmer segment in that
-- URL. Two farmers independently naming a product "Tomatoes" would both
-- get slug 'tomatoes', and getProductBySlug()'s `.maybeSingle()` would
-- throw ("multiple rows returned") the moment a second farmer listed a
-- product whose name happened to slugify the same way. Caught during the
-- Phase 5.5 regression review, before it could ever fire in production.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.products drop constraint if exists products_farmer_id_slug_key;
alter table public.products add constraint products_slug_key unique (slug);
