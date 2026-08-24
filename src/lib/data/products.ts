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
  category_icon: string | null;
};

type FarmerProfileJoin = {
  farm_name: string;
  county: string;
  verification_status: string;
} | null;

type CategoryJoin = { icon: string | null } | null;

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
  categories: CategoryJoin | CategoryJoin[];
}): MarketplaceProduct {
  const farmer = Array.isArray(row.farmer_profiles) ? row.farmer_profiles[0] : row.farmer_profiles;
  const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
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
    category_icon: category?.icon ?? null,
  };
}

const PRODUCT_FIELDS =
  "id, name, slug, price, price_unit, quantity_available, quantity_unit, min_order_quantity, images, farmer_id, categories(icon)";

// Plain embed (left join) when county isn't filtered — every product has a
// farmer_profiles row via FK, but `!inner` is only required to filter on it.
const PRODUCT_SELECT = `${PRODUCT_FIELDS}, farmer_profiles(farm_name, county, verification_status)`;
const PRODUCT_SELECT_COUNTY_FILTERED = `${PRODUCT_FIELDS}, farmer_profiles!inner(farm_name, county, verification_status)`;

const DEFAULT_PAGE_SIZE = 24;

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

/**
 * Real marketplace data only — never fabricated. Returns an empty list
 * (rendered as an empty state by the caller) when Supabase isn't
 * configured yet or no products exist, rather than showing sample data.
 */
export async function getFeaturedProducts(limit = 8): Promise<MarketplaceProduct[]> {
  const { products } = await getMarketplaceProducts({ pageSize: limit });
  return products;
}

export type MarketplaceStats = {
  productCount: number;
  verifiedFarmerCount: number;
};

// Landing-page trust signals — real counts, not invented copy. Returns
// zeros (rendered as an empty/quiet state by the caller) if Supabase isn't
// configured yet, same convention as the rest of this file.
export async function getMarketplaceStats(): Promise<MarketplaceStats> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { productCount: 0, verifiedFarmerCount: 0 };

  const supabase = await createClient();
  const [{ count: productCount }, { count: verifiedFarmerCount }] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("farmer_profiles")
      .select("*", { count: "exact", head: true })
      .eq("verification_status", "verified"),
  ]);

  return { productCount: productCount ?? 0, verifiedFarmerCount: verifiedFarmerCount ?? 0 };
}

export type MarketplaceFilters = {
  query?: string;
  categoryId?: string;
  county?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price_asc" | "price_desc";
  page?: number;
  pageSize?: number;
};

export type MarketplaceProductsResult = {
  products: MarketplaceProduct[];
  total: number;
  page: number;
  pageSize: number;
};

export async function getMarketplaceProducts(
  filters: MarketplaceFilters = {}
): Promise<MarketplaceProductsResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const empty = { products: [], total: 0, page, pageSize };

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return empty;

  try {
    const supabase = await createClient();
    let query = supabase
      .from("products")
      .select(filters.county ? PRODUCT_SELECT_COUNTY_FILTERED : PRODUCT_SELECT, {
        count: "exact",
      })
      .eq("status", "active");

    if (filters.query) {
      const term = escapeIlike(filters.query);
      query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
    }
    if (filters.categoryId) {
      query = query.eq("category_id", filters.categoryId);
    }
    if (filters.county) {
      query = query.eq("farmer_profiles.county", filters.county);
    }
    if (typeof filters.minPrice === "number" && !Number.isNaN(filters.minPrice)) {
      query = query.gte("price", filters.minPrice);
    }
    if (typeof filters.maxPrice === "number" && !Number.isNaN(filters.maxPrice)) {
      query = query.lte("price", filters.maxPrice);
    }

    if (filters.sort === "price_asc") query = query.order("price", { ascending: true });
    else if (filters.sort === "price_desc") query = query.order("price", { ascending: false });
    else query = query.order("created_at", { ascending: false });

    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, error, count } = await query;
    if (error || !data) {
      if (error) console.error("getMarketplaceProducts query failed", error);
      return empty;
    }

    return { products: data.map(mapProductRow), total: count ?? data.length, page, pageSize };
  } catch (error) {
    // Next's cookies()-based dynamic-usage bailout (thrown during the
    // build's static-vs-dynamic probe of pages like "/") must propagate,
    // not be swallowed as a query failure — Next relies on it to mark the
    // route dynamic correctly.
    if (isDynamicServerUsageError(error)) throw error;
    console.error("getMarketplaceProducts threw", error);
    return empty;
  }
}

function isDynamicServerUsageError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("DYNAMIC_SERVER_USAGE")
  );
}

export type ProductDetail = MarketplaceProduct & {
  description: string | null;
  harvest_date: string | null;
  category_id: string | null;
};

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(`${PRODUCT_SELECT}, description, harvest_date, category_id`)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  // A real query failure (RLS misconfig, connection error) is not the same
  // as "this slug doesn't exist" — surface it so the route's error.tsx
  // handles it, instead of silently rendering a branded 404.
  if (error) throw new Error(`getProductBySlug failed: ${error.message}`);
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
