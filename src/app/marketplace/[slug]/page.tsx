import { notFound } from "next/navigation";
import { BadgeCheck, MapPin, Sprout } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    notFound();
  }

  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select(
      "id, name, description, price, price_unit, quantity_available, quantity_unit, harvest_date, farmer_profiles(farm_name, county, verification_status)"
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!product) notFound();

  const farmer = Array.isArray(product.farmer_profiles)
    ? product.farmer_profiles[0]
    : product.farmer_profiles;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="flex aspect-square items-center justify-center rounded-2xl border border-border bg-accent/40">
            <Sprout className="size-16 text-primary/60" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-foreground">{product.name}</h1>
            <p className="mt-2 text-xl text-foreground">
              KES {product.price} <span className="text-base text-muted-foreground">/ {product.price_unit}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {product.quantity_available} {product.quantity_unit} available
            </p>

            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-4" />
              {farmer?.farm_name}
              {farmer?.county ? `, ${farmer.county}` : ""}
              {farmer?.verification_status === "verified" && (
                <Badge variant="success" className="gap-1">
                  <BadgeCheck className="size-3.5" />
                  Verified
                </Badge>
              )}
            </div>

            {product.description && (
              <p className="mt-6 text-sm text-foreground">{product.description}</p>
            )}

            <Button size="lg" className="mt-8" disabled>
              Cart &amp; checkout coming soon
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
