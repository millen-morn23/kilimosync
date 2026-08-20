import Link from "next/link";
import { Sprout } from "lucide-react";

import { getFeaturedProducts } from "@/lib/data/products";
import { ProductCard } from "@/components/marketplace/product-card";
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
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
