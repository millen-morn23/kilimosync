import { notFound, redirect } from "next/navigation";

import { getCurrentUser, getOwnFarmerProfile } from "@/lib/data/current-user";
import { getCategories } from "@/lib/data/categories";
import { getOwnProductById } from "@/lib/data/products";
import { ProductForm } from "@/components/farmer/product-form";
import type { PRICE_UNITS } from "@/lib/validation/product";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "farmer") redirect("/dashboard");

  const farmerProfile = await getOwnFarmerProfile();
  if (!farmerProfile) redirect("/dashboard/farmer");

  const [categories, product] = await Promise.all([
    getCategories(),
    getOwnProductById(farmerProfile.id, id),
  ]);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-foreground">Edit listing</h1>
      <div className="mt-8">
        <ProductForm
          categories={categories}
          productId={product.id}
          defaultValues={{
            name: product.name,
            categoryId: product.categoryId ?? "",
            description: product.description ?? "",
            price: product.price,
            priceUnit: product.priceUnit as (typeof PRICE_UNITS)[number],
            quantityAvailable: product.quantityAvailable,
            quantityUnit: product.quantityUnit as (typeof PRICE_UNITS)[number],
            minOrderQuantity: product.minOrderQuantity,
            harvestDate: product.harvestDate ?? "",
            images: product.images,
          }}
        />
      </div>
    </div>
  );
}
