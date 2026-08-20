import { createClient } from "@/lib/supabase/server";

export type FeaturedProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  price_unit: string;
  quantity_available: number;
  quantity_unit: string;
  images: string[];
  farmer_id: string;
  farm_name: string;
  county: string;
  verification_status: string;
};

/**
 * Real marketplace data only — never fabricated. Returns an empty list
 * (rendered as an empty state by the caller) when Supabase isn't
 * configured yet or no products exist, rather than showing sample data.
 */
export async function getFeaturedProducts(limit = 8): Promise<FeaturedProduct[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return [];
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, slug, price, price_unit, quantity_available, quantity_unit, images, farmer_id, farmer_profiles(farm_name, county, verification_status)"
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((row) => {
      const farmer = Array.isArray(row.farmer_profiles)
        ? row.farmer_profiles[0]
        : row.farmer_profiles;
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        price: row.price,
        price_unit: row.price_unit,
        quantity_available: row.quantity_available,
        quantity_unit: row.quantity_unit,
        images: row.images ?? [],
        farmer_id: row.farmer_id,
        farm_name: farmer?.farm_name ?? "KilimoSync farmer",
        county: farmer?.county ?? "",
        verification_status: farmer?.verification_status ?? "pending",
      };
    });
  } catch {
    return [];
  }
}
