import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/supabase/types";

export type AnalyticsPeriod = "7d" | "30d" | "90d" | "12m";
export type Bucket = "day" | "week" | "month";

export function periodRange(period: AnalyticsPeriod): { start: Date; end: Date; bucket: Bucket } {
  const end = new Date();
  const start = new Date(end);

  switch (period) {
    case "7d":
      start.setDate(start.getDate() - 7);
      return { start, end, bucket: "day" };
    case "30d":
      start.setDate(start.getDate() - 30);
      return { start, end, bucket: "day" };
    case "90d":
      start.setDate(start.getDate() - 90);
      return { start, end, bucket: "week" };
    case "12m":
      start.setMonth(start.getMonth() - 12);
      return { start, end, bucket: "month" };
  }
}

export type AnalyticsOverview = {
  totalUsers: number;
  totalFarmers: number;
  verifiedFarmers: number;
  pendingFarmers: number;
  totalBuyers: number;
  activeProducts: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  grossTransactionValue: number;
  platformRevenue: number;
  successfulPayments: number;
  failedPayments: number;
  openDisputes: number;
};

// RLS (`security invoker` on every admin_* function — see
// 0009_analytics.sql) is the real boundary: a non-admin caller gets
// near-empty aggregates back, not another user's data. The /admin layout
// guard is defense-in-depth on top of that, not the only check.
export async function getAnalyticsOverview(): Promise<AnalyticsOverview | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_analytics_overview").single();
  if (!data) return null;

  return {
    totalUsers: data.total_users,
    totalFarmers: data.total_farmers,
    verifiedFarmers: data.verified_farmers,
    pendingFarmers: data.pending_farmers,
    totalBuyers: data.total_buyers,
    activeProducts: data.active_products,
    totalOrders: data.total_orders,
    completedOrders: data.completed_orders,
    cancelledOrders: data.cancelled_orders,
    grossTransactionValue: data.gross_transaction_value,
    platformRevenue: data.platform_revenue,
    successfulPayments: data.successful_payments,
    failedPayments: data.failed_payments,
    openDisputes: data.open_disputes,
  };
}

export type OrdersOverTimePoint = {
  bucket: string;
  totalOrders: number;
  paidOrders: number;
  grossValue: number;
  platformRevenue: number;
};

export async function getOrdersOverTime(
  period: AnalyticsPeriod,
  filters: { county?: string; statuses?: OrderStatus[] } = {}
): Promise<OrdersOverTimePoint[]> {
  const { start, end, bucket } = periodRange(period);
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_orders_over_time", {
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_bucket: bucket,
    p_county: filters.county ?? null,
    p_statuses: filters.statuses ?? null,
  });

  return (data ?? []).map((row) => ({
    bucket: row.bucket,
    totalOrders: row.total_orders,
    paidOrders: row.paid_orders,
    grossValue: row.gross_value,
    platformRevenue: row.platform_revenue,
  }));
}

export type UserGrowthPoint = {
  bucket: string;
  newBuyers: number;
  newFarmers: number;
  newlyVerifiedFarmers: number;
};

export async function getUserGrowth(period: AnalyticsPeriod): Promise<UserGrowthPoint[]> {
  const { start, end, bucket } = periodRange(period);
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_user_growth", {
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_bucket: bucket,
  });

  return (data ?? []).map((row) => ({
    bucket: row.bucket,
    newBuyers: row.new_buyers,
    newFarmers: row.new_farmers,
    newlyVerifiedFarmers: row.newly_verified_farmers,
  }));
}

export type TopProductRow = {
  productId: string | null;
  productName: string;
  categoryName: string;
  unitsSold: number;
  revenue: number;
};

export async function getTopProducts(
  period: AnalyticsPeriod,
  filters: { categoryId?: string; county?: string } = {},
  limit = 10
): Promise<TopProductRow[]> {
  const { start, end } = periodRange(period);
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_top_products", {
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_category_id: filters.categoryId ?? null,
    p_county: filters.county ?? null,
    p_limit: limit,
  });

  return (data ?? []).map((row) => ({
    productId: row.product_id,
    productName: row.product_name,
    categoryName: row.category_name,
    unitsSold: row.units_sold,
    revenue: row.revenue,
  }));
}

export type TopCategoryRow = {
  categoryId: string | null;
  categoryName: string;
  orderCount: number;
  unitsSold: number;
  transactionValue: number;
};

export async function getTopCategories(
  period: AnalyticsPeriod,
  filters: { county?: string } = {},
  limit = 10
): Promise<TopCategoryRow[]> {
  const { start, end } = periodRange(period);
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_top_categories", {
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_county: filters.county ?? null,
    p_limit: limit,
  });

  return (data ?? []).map((row) => ({
    categoryId: row.category_id,
    categoryName: row.category_name,
    orderCount: row.order_count,
    unitsSold: row.units_sold,
    transactionValue: row.transaction_value,
  }));
}

export type CountyActivityRow = {
  county: string;
  farmerCount: number;
  buyerCount: number;
  orderCount: number;
  transactionValue: number;
};

export async function getCountyActivity(): Promise<CountyActivityRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_county_activity");

  return (data ?? []).map((row) => ({
    county: row.county,
    farmerCount: row.farmer_count,
    buyerCount: row.buyer_count,
    orderCount: row.order_count,
    transactionValue: row.transaction_value,
  }));
}
