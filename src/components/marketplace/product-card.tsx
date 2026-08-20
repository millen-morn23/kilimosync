import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, MapPin, Sprout } from "lucide-react";

import type { MarketplaceProduct } from "@/lib/data/products";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function ProductCard({ product }: { product: MarketplaceProduct }) {
  return (
    <Link href={`/marketplace/${product.slug}`}>
      <Card className="h-full gap-3 overflow-hidden py-0 transition-shadow hover:shadow-md">
        <div className="relative flex aspect-square items-center justify-center bg-accent/50">
          {product.images[0] ? (
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <Sprout className="size-10 text-primary/60" />
          )}
        </div>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <h3 className="font-medium text-foreground">{product.name}</h3>
          <p className="text-sm text-muted-foreground">
            KES {product.price} / {product.price_unit}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">
              {product.farm_name}
              {product.county ? `, ${product.county}` : ""}
            </span>
            {product.verification_status === "verified" && (
              <Badge variant="success" className="ml-auto shrink-0">
                <BadgeCheck className="size-3" />
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
