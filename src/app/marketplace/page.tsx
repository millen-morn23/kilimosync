import type { Metadata } from "next";
import { Sprout } from "lucide-react";

import { getMarketplaceProducts } from "@/lib/data/products";
import { getCategories } from "@/lib/data/categories";
import { KENYAN_COUNTIES } from "@/lib/validation/auth";
import { SiteHeaderContainer } from "@/components/marketing/site-header-container";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ProductCard } from "@/components/marketplace/product-card";
import { MarketplaceFiltersBar } from "@/components/marketplace/marketplace-filters";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Marketplace" };

type SearchParams = {
  q?: string;
  category?: string;
  county?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
};

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const sort =
    params.sort === "price_asc" || params.sort === "price_desc" ? params.sort : "newest";

  const [products, categories] = await Promise.all([
    getMarketplaceProducts({
      query: params.q,
      categoryId: params.category,
      county: params.county,
      minPrice: params.minPrice ? Number(params.minPrice) : undefined,
      maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
      sort,
      limit: 48,
    }),
    getCategories(),
  ]);

  const hasFilters = Boolean(
    params.q || params.category || params.county || params.minPrice || params.maxPrice
  );

  return (
    <>
      <SiteHeaderContainer />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Marketplace</h1>
        <p className="mt-2 text-muted-foreground">
          Fresh produce listed directly by Kenyan farmers.
        </p>

        <div className="mt-8">
          <MarketplaceFiltersBar
            categories={categories}
            counties={KENYAN_COUNTIES}
            defaultValues={{
              q: params.q ?? "",
              category: params.category ?? "",
              county: params.county ?? "",
              minPrice: params.minPrice ?? "",
              maxPrice: params.maxPrice ?? "",
              sort,
            }}
          />
        </div>

        {products.length === 0 ? (
          <Card className="mt-10 items-center gap-3 py-20 text-center">
            <Sprout className="size-10 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              {hasFilters ? "No listings match your filters" : "No listings yet"}
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {hasFilters
                ? "Try widening your search or clearing a filter."
                : "Farmer listings will appear here as soon as they go live."}
            </p>
          </Card>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
