import { notFound } from "next/navigation";
import Image from "next/image";
import { BadgeCheck, MapPin, Sprout, Star } from "lucide-react";

import { getProductBySlug, getSimilarProducts } from "@/lib/data/products";
import { getCurrentUser } from "@/lib/data/current-user";
import { getReviewsForProduct } from "@/lib/data/reviews";
import { SiteHeaderContainer } from "@/components/marketing/site-header-container";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ProductCard } from "@/components/marketplace/product-card";
import { AddToCartForm } from "@/components/marketplace/add-to-cart-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [similar, user, { reviews, averageRating }] = await Promise.all([
    getSimilarProducts(product.category_id, product.id),
    getCurrentUser(),
    getReviewsForProduct(product.id),
  ]);

  return (
    <>
      <SiteHeaderContainer />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-border bg-accent/40">
            {product.images[0] ? (
              <Image
                src={product.images[0]}
                alt={product.name}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <Sprout className="size-16 text-primary/60" />
            )}
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-foreground">{product.name}</h1>
            <p className="mt-2 text-xl text-foreground">
              KES {product.price}{" "}
              <span className="text-base text-muted-foreground">/ {product.price_unit}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {product.quantity_available} {product.quantity_unit} available
            </p>

            {averageRating !== null && (
              <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                <Star className="size-4 fill-warning text-warning" />
                {averageRating.toFixed(1)} ({reviews.length} review{reviews.length === 1 ? "" : "s"})
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-4" />
              {product.farm_name}
              {product.county ? `, ${product.county}` : ""}
              {product.verification_status === "verified" && (
                <Badge variant="success" className="gap-1">
                  <BadgeCheck className="size-3.5" />
                  Verified
                </Badge>
              )}
            </div>

            {product.description && (
              <p className="mt-6 text-sm text-foreground">{product.description}</p>
            )}

            {product.harvest_date && (
              <p className="mt-2 text-xs text-muted-foreground">
                Harvested {new Date(product.harvest_date).toLocaleDateString("en-KE")}
              </p>
            )}

            <AddToCartForm
              productId={product.id}
              minOrderQuantity={product.min_order_quantity}
              quantityAvailable={product.quantity_available}
              quantityUnit={product.quantity_unit}
              isAuthenticated={Boolean(user)}
            />
          </div>
        </div>

        {reviews.length > 0 && (
          <div className="mt-16">
            <h2 className="text-xl font-semibold text-foreground">Reviews</h2>
            <div className="mt-6 space-y-3">
              {reviews.slice(0, 10).map((review) => (
                <Card key={review.id}>
                  <CardContent className="space-y-1 py-4">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={`size-4 ${n <= review.rating ? "fill-warning text-warning" : "text-muted-foreground"}`}
                        />
                      ))}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString("en-KE")}
                      </span>
                    </div>
                    {review.comment && <p className="text-sm text-foreground">{review.comment}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {similar.length > 0 && (
          <div className="mt-16">
            <h2 className="text-xl font-semibold text-foreground">Similar produce</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {similar.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
