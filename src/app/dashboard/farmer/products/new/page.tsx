import { redirect } from "next/navigation";

import { getCurrentUser, getOwnFarmerProfile } from "@/lib/data/current-user";
import { getCategories } from "@/lib/data/categories";
import { ProductForm } from "@/components/farmer/product-form";

export default async function NewProductPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "farmer") redirect("/dashboard");

  const farmerProfile = await getOwnFarmerProfile();
  if (!farmerProfile) redirect("/dashboard/farmer");

  const categories = await getCategories();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-foreground">Add produce</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        List a new product. It goes live on the marketplace immediately.
      </p>
      <div className="mt-8">
        <ProductForm categories={categories} />
      </div>
    </div>
  );
}
