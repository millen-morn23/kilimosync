import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, MapPin, Sprout } from "lucide-react";

import { getFeaturedProducts } from "@/lib/data/products";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Marketplace" };

export default async function MarketplacePage() {
  const products = await getFeaturedProducts(48);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Marketplace</h1>
        <p className="mt-2 text-muted-foreground">
          Fresh produce listed directly by Kenyan farmers.
        </p>

        {products.length === 0 ? (
          <Card className="mt-10 items-center gap-3 py-20 text-center">
            <Sprout className="size-10 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              No listings yet
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Search, filters and full checkout are launching in the next
              development phase. Farmer listings will appear here as soon as
              they go live.
            </p>
          </Card>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <Link key={product.id} href={`/marketplace/${product.slug}`}>
                <Card className="h-full gap-3 overflow-hidden py-0 transition-shadow hover:shadow-md">
                  <div className="flex aspect-square items-center justify-center bg-accent/50">
                    <Sprout className="size-10 text-primary/60" />
                  </div>
                  <div className="flex flex-col gap-2 px-4 pb-4">
                    <h3 className="font-medium text-foreground">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      KES {product.price} / {product.price_unit}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3.5" />
                      {product.farm_name}
                      {product.county ? `, ${product.county}` : ""}
                      {product.verification_status === "verified" && (
                        <Badge variant="success" className="ml-1">
                          <BadgeCheck className="size-3" />
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
