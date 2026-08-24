/**
 * Backfills public.products.images with verified, product-accurate
 * Unsplash photographs for the demo catalog seeded by seed-demo-data.ts.
 *
 * This is a data update, not a schema change — products.images already
 * exists (text[], default '{}', see supabase/migrations/0001_init.sql)
 * — so this is a plain script, not a numbered migration, matching how
 * seed-demo-data.ts itself is handled. See scripts/product-image-manifest.ts
 * for the full manifest and docs/PRODUCT_IMAGES.md for the sourcing
 * process and what's still missing.
 *
 * Usage:
 *   npx tsx scripts/apply-product-images.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
 * .env.local. Idempotent: re-running just re-applies the same
 * deterministic URLs, safe to run as many times as you like.
 */

import { existsSync } from "node:fs";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

import { createClient } from "@supabase/supabase-js";

import { PRODUCT_IMAGE_MANIFEST } from "./product-image-manifest";
import type { Database } from "../src/lib/supabase/types";

// Same rationale as seed-demo-data.ts: src/lib/supabase/admin.ts imports
// `server-only`, which throws outside a Next.js bundling context.
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local."
    );
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function main() {
  const admin = createAdminClient();

  const { data: categoryRows, error: categoryError } = await admin
    .from("categories")
    .select("id, slug");
  if (categoryError || !categoryRows) {
    throw new Error(`Could not load categories: ${categoryError?.message}`);
  }
  const categoryIdBySlug = new Map(categoryRows.map((c) => [c.slug, c.id]));

  let updatedRows = 0;
  let updatedProducts = 0;
  let skippedProducts = 0;

  console.log("Applying product images…\n");

  for (const entry of PRODUCT_IMAGE_MANIFEST) {
    if (!entry.image) {
      skippedProducts += 1;
      console.log(`  – ${entry.name} (${entry.categorySlug}): skipped — ${entry.note ?? "no image"}`);
      continue;
    }

    const categoryId = categoryIdBySlug.get(entry.categorySlug);
    if (!categoryId) {
      console.error(`  ✗ ${entry.name}: category slug "${entry.categorySlug}" not found — run migrations first.`);
      continue;
    }

    const { data, error } = await admin
      .from("products")
      .update({ images: [entry.image.url] })
      .eq("category_id", categoryId)
      .eq("name", entry.name)
      .select("id");

    if (error) {
      console.error(`  ✗ ${entry.name}: ${error.message}`);
      continue;
    }

    const count = data?.length ?? 0;
    updatedProducts += 1;
    updatedRows += count;
    console.log(`  + ${entry.name} (${entry.categorySlug}): ${count} row(s) updated`);
  }

  console.log(
    `\nDone. ${updatedProducts} distinct products applied across ${updatedRows} product rows. ` +
      `${skippedProducts} distinct products left on the category-icon fallback (no verified photo).`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
