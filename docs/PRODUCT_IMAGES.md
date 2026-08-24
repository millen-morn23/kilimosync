# Product imagery

The demo catalog (`scripts/seed-demo-data.ts`) creates 136 product rows from
56 distinct product templates (each template replicated across 2-3 farmers
per category). `public.products.images` (`text[]`, see
`supabase/migrations/0001_init.sql`) already existed for this — no schema
change was needed to add photography.

## Source and process

Photographs are real Unsplash photos, hotlinked from `images.unsplash.com`
(no image generation, no AI-synthesized imagery, no
`source.unsplash.com` — that endpoint is deprecated and serves a random
image per request, which isn't deterministic and isn't accuracy-checkable).

For each of the 56 product names:

1. A targeted web search (e.g. "fresh ginger root", never a generic
   "vegetables" search) found a specific, real Unsplash photo page.
2. The page's real CDN image URL and photographer credit were extracted
   directly from that page — never fabricated or guessed.
3. The image was downloaded and **visually inspected** before being
   accepted, to confirm it actually shows the named product.
4. `plus.unsplash.com` (Unsplash+ premium) results were rejected even when
   visually correct — that tier requires a paid license this app doesn't
   have, so using it would violate Unsplash's terms.

`scripts/product-image-manifest.ts` is the resulting manifest: one entry
per product name (not per row — the same photo applies to every farmer
selling that product), each `{ name, categorySlug, image: {url, source,
photographer, photographerUrl, alt} | null, note? }`. `image: null` means
no confident, product-accurate, correctly-licensed photo could be found —
those products keep the existing category icon/tint fallback
(`src/lib/category-icons.tsx`) rather than a wrong or unlicensed photo.

**Coverage: 42 of 56 distinct products (106 of 136 rows) have a verified
photo.** The 14 without one, and why:

| Product | Category | Reason |
|---|---|---|
| White Maize | Grains & Cereals | No confident photo of loose dried kernels found |
| Sorghum | Grains & Cereals | No confident photo of the grain itself found |
| Barley | Grains & Cereals | Accurate match found, but Unsplash+ premium — excluded |
| Brown Rice | Grains & Cereals | Accurate match found, but Unsplash+ premium — excluded |
| Yams | Tubers & Roots | Unsplash mislabels sweet potatoes as "yam"; no true yam found |
| Purple Potatoes | Tubers & Roots | Only found a mixed-color potato medley, not purple-specific |
| Rosecoco Beans | Legumes | No confidently-labeled match found |
| Pigeon Peas | Legumes | No confidently-labeled match found |
| Eggs | Dairy & Eggs | Accurate match found, but Unsplash+ premium — excluded |
| Butter | Dairy & Eggs | Accurate match found, but Unsplash+ premium — excluded |
| Mala (Fermented Milk) | Dairy & Eggs | Candidate visually identical to the Fresh Milk photo — would mislead buyers |
| Fresh Cream | Dairy & Eggs | No unambiguous "plain cream" photo found (all candidates were yoghurt-adjacent or a savory dish) |
| Goat Meat | Poultry & Livestock | No photo confirmed as goat specifically (vs. lamb/beef/pork) |
| Rabbit Meat | Poultry & Livestock | No raw butchered rabbit meat found (only live pets or unrelated dishes) |

## Applying to the database

```
npm run images:apply
```

Runs `scripts/apply-product-images.ts` — same `.env.local` / service-role
pattern as `seed:demo`. For each manifest entry with an image, it updates
`images = [url]` on every product row matching that category + name.
Idempotent: safe to re-run any time (e.g. after extending the manifest).

## Next.js image handling

Product images render via `next/image` with the `unoptimized` prop
(already the existing pattern in `ProductCard` and the product detail
page before this change) — that bypasses Next's Image Optimization proxy
entirely and renders a plain `<img src>`, so `next.config.ts` needs no
`images.remotePatterns` entry for `images.unsplash.com`. Verified directly:
a throwaway test route confirmed the rendered `<img>` tag points straight
at the Unsplash CDN URL with no proxy involved.

Every card/detail view still falls back to the category icon/tint
(`src/lib/category-icons.tsx`) when `images` is empty — nothing about that
fallback path changed.

## Extending the manifest later

To source a photo for one of the 14 missing products (or a future
product), add an entry to `PRODUCT_IMAGE_MANIFEST` in
`scripts/product-image-manifest.ts` following the same process above —
find a specific real Unsplash photo page, extract its real CDN URL, and
visually verify the download before adding it — then re-run
`npm run images:apply`.
