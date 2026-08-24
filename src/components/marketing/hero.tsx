import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin, Sprout } from "lucide-react";

import { getFeaturedProducts, getMarketplaceStats } from "@/lib/data/products";
import { renderCategoryIcon, getCategoryTint } from "@/lib/category-icons";
import { Button } from "@/components/ui/button";

export async function Hero() {
  const [products, stats] = await Promise.all([
    getFeaturedProducts(4),
    getMarketplaceStats(),
  ]);

  return (
    <section className="relative overflow-hidden bg-background">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-28">
        <div>
          <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-medium text-primary">
            Now onboarding pilot farmers in Kenya
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            From Kenyan Farms to Your Table.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            KilimoSync connects farmers directly with buyers, making fresh
            produce easier to sell, discover and purchase.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/marketplace">
                Explore Fresh Produce
                <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/signup?role=farmer">Sell on KilimoSync</Link>
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="w-full rounded-2xl border border-border bg-gradient-to-br from-accent/40 to-background p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-secondary opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-secondary" />
                </span>
                <p className="text-sm font-medium text-foreground">Live on the marketplace</p>
              </div>
              {stats.productCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {stats.productCount} listings · {stats.verifiedFarmerCount} verified farms
                </p>
              )}
            </div>

            {products.length === 0 ? (
              <div className="mt-8 flex flex-col items-center gap-2 py-8 text-center">
                <Sprout className="size-8 text-primary/60" />
                <p className="text-sm text-muted-foreground">
                  New listings will appear here as farmers join.
                </p>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {products.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={`/marketplace/${product.slug}`}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <span
                        className={`relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg ${
                          product.images[0] ? "bg-accent/50" : getCategoryTint(product.category_icon)
                        }`}
                      >
                        {product.images[0] ? (
                          <Image
                            src={product.images[0]}
                            alt={product.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          renderCategoryIcon(product.category_icon, {
                            className: "size-5",
                            strokeWidth: 1.75,
                          })
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {product.name}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3 shrink-0" />
                          <span className="truncate">
                            {product.farm_name}
                            {product.county ? `, ${product.county}` : ""}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-medium text-foreground">
                        KES {product.price}
                        <span className="text-muted-foreground">/{product.price_unit}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
