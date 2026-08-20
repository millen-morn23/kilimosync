import Link from "next/link";
import { BadgeCheck, MapPin, Sprout } from "lucide-react";

import { getFeaturedProducts } from "@/lib/data/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export async function FeaturedProduce() {
  const products = await getFeaturedProducts(8);

  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
              Featured produce
            </h2>
            <p className="mt-2 text-muted-foreground">
              Fresh listings from farmers on KilimoSync.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/marketplace">Browse marketplace</Link>
          </Button>
        </div>

        {products.length === 0 ? (
          <Card className="mt-10 items-center gap-3 py-16 text-center">
            <Sprout className="size-10 text-primary" />
            <p className="max-w-sm text-sm text-muted-foreground">
              The marketplace is opening its doors. Be one of the first
              farmers to list produce, or check back soon for fresh listings.
            </p>
            <Button asChild>
              <Link href="/signup?role=farmer">List your produce</Link>
            </Button>
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
      </div>
    </section>
  );
}
