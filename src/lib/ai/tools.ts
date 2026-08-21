import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  getMarketplaceProducts,
  getOwnFarmerProducts,
  getProductBySlug,
  type MarketplaceFilters,
} from "@/lib/data/products";
import { getBuyerOrders, getFarmerOrderLines } from "@/lib/data/orders";
import { getPaymentStats } from "@/lib/data/payments";
import type { UserRole } from "@/lib/supabase/types";

export type ToolContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  role: UserRole;
  farmerProfileId: string | null;
};

export type Tool = {
  name: string;
  description: string;
  roles: UserRole[];
  inputSchema: Record<string, unknown>;
  zodSchema: z.ZodTypeAny;
  run: (input: unknown, ctx: ToolContext) => Promise<unknown>;
};

// ── Buyer tools ─────────────────────────────────────────────────────────

const searchProductsSchema = z.object({
  query: z.string().max(120).optional(),
  category: z.string().max(60).optional(),
  county: z.string().max(60).optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
});

const searchProducts: Tool = {
  name: "search_products",
  description:
    "Search real, currently-active KilimoSync marketplace listings. Returns up to 10 matching products with their actual price, farmer, county and available quantity. Never invent a product that isn't in these results.",
  roles: ["buyer"],
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free-text search over product name" },
      category: { type: "string", description: "Category name, if known" },
      county: { type: "string", description: "Kenyan county to filter by" },
      minPrice: { type: "number", description: "Minimum price in KES" },
      maxPrice: { type: "number", description: "Maximum price in KES" },
    },
  },
  zodSchema: searchProductsSchema,
  async run(rawInput) {
    const input = searchProductsSchema.parse(rawInput);
    const filters: MarketplaceFilters = {
      query: input.query,
      county: input.county,
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
      limit: 10,
    };
    const products = await getMarketplaceProducts(filters);
    return {
      count: products.length,
      products: products.map((p) => ({
        name: p.name,
        slug: p.slug,
        price: p.price,
        unit: p.price_unit,
        available: `${p.quantity_available} ${p.quantity_unit}`,
        farm: p.farm_name,
        county: p.county,
        verified: p.verification_status === "verified",
      })),
    };
  },
};

const getProductSchema = z.object({ slug: z.string().min(1).max(160) });

const getProduct: Tool = {
  name: "get_product",
  description: "Get full details for one real marketplace product by its slug.",
  roles: ["buyer"],
  inputSchema: {
    type: "object",
    properties: { slug: { type: "string" } },
    required: ["slug"],
  },
  zodSchema: getProductSchema,
  async run(rawInput) {
    const { slug } = getProductSchema.parse(rawInput);
    const product = await getProductBySlug(slug);
    if (!product) return { found: false };
    return {
      found: true,
      name: product.name,
      price: product.price,
      unit: product.price_unit,
      available: `${product.quantity_available} ${product.quantity_unit}`,
      minOrder: product.min_order_quantity,
      farm: product.farm_name,
      county: product.county,
      verified: product.verification_status === "verified",
      description: product.description,
    };
  },
};

const getUserOrders: Tool = {
  name: "get_user_orders",
  description: "Get the signed-in buyer's own order history. Never accepts a buyer id — it's always the caller.",
  roles: ["buyer"],
  inputSchema: { type: "object", properties: {} },
  zodSchema: z.object({}),
  async run(_input, ctx) {
    if (ctx.role !== "buyer") return { error: "Not available for this role." };
    const orders = await getBuyerOrders();
    return {
      count: orders.length,
      orders: orders.slice(0, 10).map((o) => ({
        id: o.id.slice(0, 8),
        total: o.total_amount,
        paymentStatus: o.payment_status,
        orderStatus: o.order_status,
        placedAt: o.created_at,
      })),
    };
  },
};

// ── Farmer tools ────────────────────────────────────────────────────────

const getFarmerProducts: Tool = {
  name: "get_farmer_products",
  description: "Get the signed-in farmer's own product listings, including paused/sold-out ones.",
  roles: ["farmer"],
  inputSchema: { type: "object", properties: {} },
  zodSchema: z.object({}),
  async run(_input, ctx) {
    if (!ctx.farmerProfileId) return { error: "No farm profile yet." };
    const products = await getOwnFarmerProducts(ctx.farmerProfileId);
    return {
      count: products.length,
      products: products.map((p) => ({
        name: p.name,
        price: p.price,
        unit: p.price_unit,
        available: `${p.quantity_available} ${p.quantity_unit}`,
        status: p.status,
      })),
    };
  },
};

const getFarmerSales: Tool = {
  name: "get_farmer_sales",
  description: "Summarize the signed-in farmer's own order lines — counts and totals by payment status. Real data only.",
  roles: ["farmer"],
  inputSchema: { type: "object", properties: {} },
  zodSchema: z.object({}),
  async run(_input, ctx) {
    if (!ctx.farmerProfileId) return { error: "No farm profile yet." };
    const lines = await getFarmerOrderLines(ctx.farmerProfileId);
    const paid = lines.filter((l) => l.paymentStatus === "PAID");
    return {
      totalOrderLines: lines.length,
      paidOrderLines: paid.length,
      totalRevenueKes: Math.round(paid.reduce((sum, l) => sum + l.subtotal, 0) * 100) / 100,
    };
  },
};

const createProductDraftSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000),
  suggestedPrice: z.number().positive().max(1_000_000).optional(),
  suggestedUnit: z.string().max(20).optional(),
});

const createProductDraft: Tool = {
  name: "create_product_draft",
  description:
    "Draft a product listing (name + description, optionally a suggested price/unit) for the farmer to review. This NEVER publishes a listing directly — it only returns a draft the farmer must open, edit if needed, and explicitly submit in the 'Add produce' form before it becomes real.",
  roles: ["farmer"],
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      suggestedPrice: { type: "number" },
      suggestedUnit: { type: "string" },
    },
    required: ["name", "description"],
  },
  zodSchema: createProductDraftSchema,
  async run(rawInput) {
    const draft = createProductDraftSchema.parse(rawInput);
    return { draft, note: "Not saved. The farmer must review and submit this in the product form." };
  },
};

// ── Admin tools ─────────────────────────────────────────────────────────

const getPlatformAnalytics: Tool = {
  name: "get_platform_analytics",
  description: "Get real, current platform-wide counts: users, farmers, buyers, verified farmers, and payment stats. Admin only, re-verified server-side.",
  roles: ["admin"],
  inputSchema: { type: "object", properties: {} },
  zodSchema: z.object({}),
  async run(_input, ctx) {
    if (ctx.role !== "admin") return { error: "Admin access required." };
    const [{ count: totalUsers }, { count: farmers }, { count: buyers }, { count: verifiedFarmers }, paymentStats] =
      await Promise.all([
        ctx.supabase.from("users").select("*", { count: "exact", head: true }),
        ctx.supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "farmer"),
        ctx.supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "buyer"),
        ctx.supabase
          .from("farmer_profiles")
          .select("*", { count: "exact", head: true })
          .eq("verification_status", "verified"),
        getPaymentStats(),
      ]);
    return {
      totalUsers: totalUsers ?? 0,
      farmers: farmers ?? 0,
      buyers: buyers ?? 0,
      verifiedFarmers: verifiedFarmers ?? 0,
      successfulPayments: paymentStats.paid,
      failedPayments: paymentStats.failed,
      pendingPayments: paymentStats.pendingOrInFlight,
      grossTransactionValueKes: paymentStats.grossTransactionValue,
    };
  },
};

const ALL_TOOLS: Tool[] = [
  searchProducts,
  getProduct,
  getUserOrders,
  getFarmerProducts,
  getFarmerSales,
  createProductDraft,
  getPlatformAnalytics,
];

export function toolsForRole(role: UserRole): Tool[] {
  return ALL_TOOLS.filter((tool) => tool.roles.includes(role));
}

export function findTool(name: string, role: UserRole): Tool | null {
  const tool = ALL_TOOLS.find((t) => t.name === name);
  if (!tool || !tool.roles.includes(role)) return null;
  return tool;
}
