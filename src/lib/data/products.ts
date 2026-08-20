import { createClient } from "@/lib/supabase/server";

export type MarketplaceProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  price_unit: string;
  quantity_available: number;
  quantity_unit: string;
  min_order_quantity: number;
  images: string[];
  farmer_id: string;
  farm_name: string;
  county: string;
  verification_status: string;
};

type FarmerProfileJoin = {
  farm_name: string;
  county: string;
  verification_status: string;
} | null;

function mapProductRow(row: {
  id: string;
  name: string;
  slug: string;
  price: number;
  price_unit: string;
  quantity_available: number;
  quantity_unit: string;
  min_order_quantity: number;
  images: string[] | null;
  farmer_id: string;
  farmer_profiles: FarmerProfileJoin | FarmerProfileJoin[];
}): MarketplaceProduct {
  const farmer = Array.isArray(row.farmer_profiles) ? row.farmer_profiles[0] : row.farmer_profiles;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    price: row.price,
    price_unit: row.price_unit,
    quantity_available: row.quantity_available,
    quantity_unit: row.quantity_unit,
    min_order_quantity: row.min_order_quantity,
    images: row.images ?? [],
    farmer_id: row.farmer_id,
    farm_name: farmer?.farm_name ?? "KilimoSync farmer",
    county: farmer?.county ?? "",
    verification_status: farmer?.verification_status ?? "pending",
  };
}

const PRODUCT_SELECT =
  "id, name, slug, price, price_unit, quantity_available, quantity_unit, min_order_quantity, images, farmer_id, farmer_profiles(farm_name, county, verification_status)";

/**
 * Real marketplace data only — never fabricated. Returns an empty list
 * (rendered as an empty state by the caller) when Supabase isn't
 * configured yet or no products exist, rather than showing sample data.
 */
export async function getFeaturedProducts(limit = 8): Promise<MarketplaceProduct[]> {
  return getMarketplaceProducts({ limit });
}

export type MarketplaceFilters = {
  query?: string;
  categoryId?: string;
  county?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price_asc" | "price_desc";
  limit?: number;
};

export async function getMarketplaceProducts(
  filters: MarketplaceFilters = {}
): Promise<MarketplaceProduct[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];

  try {
    const supabase = await createClient();
    let query = supabase.from("products").select(PRODUCT_SELECT).eq("status", "active");

    if (filters.query) {
      query = query.ilike("name", `%${filters.query}%`);
    }
    if (filters.categoryId) {
      query = query.eq("category_id", filters.categoryId);
    }
    if (typeof filters.minPrice === "number") {
      query = query.gte("price", filters.minPrice);
    }
    if (typeof filters.maxPrice === "number") {
      query = query.lte("price", filters.maxPrice);
    }

    if (filters.sort === "price_asc") query = query.order("price", { ascending: true });
    else if (filters.sort === "price_desc") query = query.order("price", { ascending: false });
    else query = query.order("created_at", { ascending: false });

    query = query.limit(filters.limit ?? 48);

    const { data, error } = await query;
    if (error || !data) return [];

    let mapped = data.map(mapProductRow);

    // County filters against the joined farmer_profiles row, which
    // PostgREST can't filter server-side through an embedded resource
    // without a dedicated view — filtered in-memory instead, acceptable
    // at MVP catalog sizes.
    if (filters.county) {
      mapped = mapped.filter((p) => p.county === filters.county);
    }

    return mapped;
  } catch {
    return [];
  }
}

export type ProductDetail = MarketplaceProduct & {
  description: string | null;
  harvest_date: string | null;
  category_id: string | null;
};

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(`${PRODUCT_SELECT}, description, harvest_date, category_id`)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!data) return null;
  return {
    ...mapProductRow(data),
    description: data.description,
    harvest_date: data.harvest_date,
    category_id: data.category_id,
  };
}

export async function getSimilarProducts(
  categoryId: string | null,
  excludeProductId: string,
  limit = 4
): Promise<MarketplaceProduct[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !categoryId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "active")
    .eq("category_id", categoryId)
    .neq("id", excludeProductId)
    .limit(limit);

  return (data ?? []).map(mapProductRow);
}

export type OwnProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  price_unit: string;
  quantity_available: number;
  quantity_unit: string;
  status: string;
  images: string[];
};

export async function getOwnFarmerProducts(farmerId: string): Promise<OwnProduct[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, slug, price, price_unit, quantity_available, quantity_unit, status, images")
    .eq("farmer_id", farmerId)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });

  return data ?? [];
}

export type OwnProductDetail = {
  id: string;
  name: string;
  categoryId: string | null;
  description: string | null;
  price: number;
  priceUnit: string;
  quantityAvailable: number;
  quantityUnit: string;
  minOrderQuantity: number;
  harvestDate: string | null;
  images: string[];
};

export async function getOwnProductById(
  farmerId: string,
  productId: string
): Promise<OwnProductDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, name, category_id, description, price, price_unit, quantity_available, quantity_unit, min_order_quantity, harvest_date, images"
    )
    .eq("id", productId)
    .eq("farmer_id", farmerId)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    categoryId: data.category_id,
    description: data.description,
    price: data.price,
    priceUnit: data.price_unit,
    quantityAvailable: data.quantity_available,
    quantityUnit: data.quantity_unit,
    minOrderQuantity: data.min_order_quantity,
    harvestDate: data.harvest_date,
    images: data.images ?? [],
  };
}
