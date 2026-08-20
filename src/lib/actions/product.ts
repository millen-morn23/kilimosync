"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createProductSchema, slugifyProductName, type CreateProductInput } from "@/lib/validation/product";

type ActionResult = { error: string } | { success: true; id: string };
type SimpleResult = { error: string } | { success: true };

async function requireFarmerProfileId(): Promise<{ farmerId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: farmerProfile } = await supabase
    .from("farmer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!farmerProfile) return { error: "Create your farm profile before listing products." };
  return { farmerId: farmerProfile.id };
}

async function uniqueSlugFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  farmerId: string,
  name: string,
  excludeProductId?: string
): Promise<string> {
  const base = slugifyProductName(name);
  let slug = base;
  let suffix = 1;

  // farmer_id + slug is unique — retry with a numeric suffix on collision.
  // Loop bound (20) is a sane ceiling for realistic catalog sizes.
  for (let attempt = 0; attempt < 20; attempt++) {
    let query = supabase
      .from("products")
      .select("id")
      .eq("farmer_id", farmerId)
      .eq("slug", slug);
    if (excludeProductId) query = query.neq("id", excludeProductId);

    const { data } = await query.maybeSingle();
    if (!data) return slug;

    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return `${base}-${Date.now()}`;
}

export async function createProduct(input: CreateProductInput): Promise<ActionResult> {
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const owner = await requireFarmerProfileId();
  if ("error" in owner) return owner;

  const supabase = await createClient();
  const { name, categoryId, description, price, priceUnit, quantityAvailable, quantityUnit, minOrderQuantity, harvestDate, images } =
    parsed.data;

  const slug = await uniqueSlugFor(supabase, owner.farmerId, name);

  const { data, error } = await supabase
    .from("products")
    .insert({
      farmer_id: owner.farmerId,
      category_id: categoryId || null,
      name,
      slug,
      description: description || null,
      price,
      price_unit: priceUnit,
      quantity_available: quantityAvailable,
      quantity_unit: quantityUnit,
      min_order_quantity: minOrderQuantity,
      harvest_date: harvestDate || null,
      images,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Could not create the listing. Please try again." };
  }

  revalidatePath("/dashboard/farmer/products");
  revalidatePath("/marketplace");
  return { success: true, id: data.id };
}

export async function updateProduct(
  productId: string,
  input: CreateProductInput
): Promise<SimpleResult> {
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const owner = await requireFarmerProfileId();
  if ("error" in owner) return owner;

  const supabase = await createClient();
  const { name, categoryId, description, price, priceUnit, quantityAvailable, quantityUnit, minOrderQuantity, harvestDate, images } =
    parsed.data;

  const slug = await uniqueSlugFor(supabase, owner.farmerId, name, productId);

  const { error } = await supabase
    .from("products")
    .update({
      category_id: categoryId || null,
      name,
      slug,
      description: description || null,
      price,
      price_unit: priceUnit,
      quantity_available: quantityAvailable,
      quantity_unit: quantityUnit,
      min_order_quantity: minOrderQuantity,
      harvest_date: harvestDate || null,
      images,
    })
    .eq("id", productId)
    .eq("farmer_id", owner.farmerId);

  if (error) {
    return { error: "Could not update the listing. Please try again." };
  }

  revalidatePath("/dashboard/farmer/products");
  revalidatePath(`/marketplace/${slug}`);
  revalidatePath("/marketplace");
  return { success: true };
}

export async function setProductStatus(
  productId: string,
  status: "active" | "paused"
): Promise<SimpleResult> {
  const owner = await requireFarmerProfileId();
  if ("error" in owner) return owner;

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ status })
    .eq("id", productId)
    .eq("farmer_id", owner.farmerId);

  if (error) return { error: "Could not update listing status." };

  revalidatePath("/dashboard/farmer/products");
  revalidatePath("/marketplace");
  return { success: true };
}

export async function deleteProduct(productId: string): Promise<SimpleResult> {
  const owner = await requireFarmerProfileId();
  if ("error" in owner) return owner;

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("farmer_id", owner.farmerId);

  if (error) {
    return { error: "Could not delete the listing. It may already be part of an order." };
  }

  revalidatePath("/dashboard/farmer/products");
  revalidatePath("/marketplace");
  return { success: true };
}
