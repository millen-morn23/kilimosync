import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Plus, Sprout } from "lucide-react";

import { getCurrentUser, getOwnFarmerProfile } from "@/lib/data/current-user";
import { getOwnFarmerProducts } from "@/lib/data/products";
import { ProductRowActions } from "@/components/farmer/product-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  sold_out: "Sold out",
};

export default async function FarmerProductsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "farmer") redirect("/dashboard");

  const farmerProfile = await getOwnFarmerProfile();
  if (!farmerProfile) redirect("/dashboard/farmer");

  const products = await getOwnFarmerProducts(farmerProfile.id);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Your listings</h1>
        <Button asChild>
          <Link href="/dashboard/farmer/products/new">
            <Plus />
            Add produce
          </Link>
        </Button>
      </div>

      {products.length === 0 ? (
        <Card className="mt-8 items-center gap-3 py-16 text-center">
          <Sprout className="size-10 text-primary" />
          <p className="max-w-sm text-sm text-muted-foreground">
            You haven&apos;t listed any produce yet.
          </p>
          <Button asChild>
            <Link href="/dashboard/farmer/products/new">Create your first listing</Link>
          </Button>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {products.map((product) => (
            <Card key={product.id}>
              <CardContent className="flex flex-wrap items-center gap-4 py-4">
                <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-accent/50">
                  {product.images[0] ? (
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <Sprout className="size-5 text-primary/60" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/farmer/products/${product.id}/edit`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {product.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    KES {product.price}/{product.price_unit} · {product.quantity_available}{" "}
                    {product.quantity_unit} available
                  </p>
                </div>

                <Badge variant={product.status === "active" ? "success" : "outline"}>
                  {STATUS_LABEL[product.status] ?? product.status}
                </Badge>

                <ProductRowActions productId={product.id} status={product.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
