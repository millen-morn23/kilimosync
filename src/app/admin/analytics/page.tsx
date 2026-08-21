import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

import {
  getAnalyticsOverview,
  getCountyActivity,
  getOrdersOverTime,
  getTopCategories,
  getTopProducts,
  getUserGrowth,
  type AnalyticsPeriod,
} from "@/lib/data/analytics";
import { getCategories } from "@/lib/data/categories";
import { KENYAN_COUNTIES } from "@/lib/validation/auth";
import type { OrderStatus } from "@/lib/supabase/types";
import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { TrendChart } from "@/components/analytics/trend-chart";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Analytics — Admin" };

const PERIODS = new Set(["7d", "30d", "90d", "12m"]);

function kes(value: number): string {
  return `KES ${value.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

function bucketLabel(bucket: string): string {
  const date = new Date(bucket);
  return date.toLocaleDateString("en-KE", { month: "short", day: "numeric" });
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; county?: string; category?: string; status?: string }>;
}) {
  const params = await searchParams;
  const period: AnalyticsPeriod = PERIODS.has(params.period ?? "") ? (params.period as AnalyticsPeriod) : "30d";
  const county = params.county || undefined;
  const categoryId = params.category || undefined;
  const status = params.status as OrderStatus | undefined;

  const [overview, ordersOverTime, userGrowth, topProducts, topCategories, countyActivity, categories] =
    await Promise.all([
      getAnalyticsOverview(),
      getOrdersOverTime(period, { county, statuses: status ? [status] : undefined }),
      getUserGrowth(period),
      getTopProducts(period, { categoryId, county }),
      getTopCategories(period, { county }),
      getCountyActivity(),
      getCategories(),
    ]);

  const overviewCards = overview
    ? [
        { label: "Total users", value: overview.totalUsers.toLocaleString() },
        { label: "Total farmers", value: overview.totalFarmers.toLocaleString() },
        { label: "Verified farmers", value: overview.verifiedFarmers.toLocaleString() },
        { label: "Pending verification", value: overview.pendingFarmers.toLocaleString() },
        { label: "Total buyers", value: overview.totalBuyers.toLocaleString() },
        { label: "Active products", value: overview.activeProducts.toLocaleString() },
        { label: "Total orders", value: overview.totalOrders.toLocaleString() },
        { label: "Completed orders", value: overview.completedOrders.toLocaleString() },
        { label: "Cancelled orders", value: overview.cancelledOrders.toLocaleString() },
        { label: "Gross transaction value", value: kes(overview.grossTransactionValue) },
        { label: "Platform revenue", value: kes(overview.platformRevenue) },
        { label: "Successful payments", value: overview.successfulPayments.toLocaleString() },
        { label: "Failed payments", value: overview.failedPayments.toLocaleString() },
        { label: "Open disputes", value: overview.openDisputes.toLocaleString() },
      ]
    : [];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Overview metrics are all-time. Charts and tables below respect the period filter; county,
        category, and order-status filters apply only where noted, since not every metric is
        scoped by those dimensions.
      </p>

      <div className="mt-6">
        <AnalyticsFilters
          categories={categories}
          counties={KENYAN_COUNTIES}
          defaultValues={{ period, county: county ?? "", category: categoryId ?? "", status: status ?? "" }}
        />
      </div>

      {!overview ? (
        <Card className="mt-8 items-center gap-3 py-16 text-center">
          <BarChart3 className="size-10 text-primary" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Not enough data yet to show platform analytics.
          </p>
        </Card>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {overviewCards.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="font-medium text-foreground">Orders over time</p>
                <p className="mb-4 text-xs text-muted-foreground">Respects county &amp; order status filters</p>
                <TrendChart
                  title="Orders"
                  points={ordersOverTime.map((p) => ({ label: bucketLabel(p.bucket), value: p.totalOrders }))}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="font-medium text-foreground">Transaction value over time</p>
                <p className="mb-4 text-xs text-muted-foreground">Respects county filter · paid orders only</p>
                <TrendChart
                  title="Gross value"
                  points={ordersOverTime.map((p) => ({ label: bucketLabel(p.bucket), value: p.grossValue }))}
                  formatValue={kes}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="font-medium text-foreground">Platform revenue over time</p>
                <p className="mb-4 text-xs text-muted-foreground">Respects county filter · paid orders only</p>
                <TrendChart
                  title="Platform revenue"
                  points={ordersOverTime.map((p) => ({ label: bucketLabel(p.bucket), value: p.platformRevenue }))}
                  formatValue={kes}
                />
              </CardContent>
            </Card>
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-semibold text-foreground">User growth</h2>
            <div className="mt-4 grid gap-6 lg:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <p className="mb-4 text-sm text-muted-foreground">New buyers</p>
                  <TrendChart
                    title="New buyers"
                    points={userGrowth.map((p) => ({ label: bucketLabel(p.bucket), value: p.newBuyers }))}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="mb-4 text-sm text-muted-foreground">New farmers</p>
                  <TrendChart
                    title="New farmers"
                    points={userGrowth.map((p) => ({ label: bucketLabel(p.bucket), value: p.newFarmers }))}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="mb-4 text-sm text-muted-foreground">Newly verified farmers</p>
                  <TrendChart
                    title="Newly verified"
                    points={userGrowth.map((p) => ({ label: bucketLabel(p.bucket), value: p.newlyVerifiedFarmers }))}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Top products</h2>
              <p className="mt-1 text-xs text-muted-foreground">Respects county &amp; category filters</p>
              <Card className="mt-4">
                <CardContent className="pt-6">
                  {topProducts.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No paid orders in this period yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-xs text-muted-foreground">
                            <th scope="col" className="pb-2 font-medium">Product</th>
                            <th scope="col" className="pb-2 font-medium">Category</th>
                            <th scope="col" className="pb-2 font-medium">Units sold</th>
                            <th scope="col" className="pb-2 font-medium">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topProducts.map((p, i) => (
                            <tr key={`${p.productId}-${i}`} className="border-t border-border">
                              <td className="py-2 text-foreground">{p.productName}</td>
                              <td className="py-2 text-muted-foreground">{p.categoryName}</td>
                              <td className="py-2 text-foreground">{p.unitsSold.toLocaleString()}</td>
                              <td className="py-2 text-foreground">{kes(p.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground">Top categories</h2>
              <p className="mt-1 text-xs text-muted-foreground">Respects county filter</p>
              <Card className="mt-4">
                <CardContent className="pt-6">
                  {topCategories.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No paid orders in this period yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-xs text-muted-foreground">
                            <th scope="col" className="pb-2 font-medium">Category</th>
                            <th scope="col" className="pb-2 font-medium">Orders</th>
                            <th scope="col" className="pb-2 font-medium">Units sold</th>
                            <th scope="col" className="pb-2 font-medium">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topCategories.map((c, i) => (
                            <tr key={`${c.categoryId}-${i}`} className="border-t border-border">
                              <td className="py-2 text-foreground">{c.categoryName}</td>
                              <td className="py-2 text-muted-foreground">{c.orderCount.toLocaleString()}</td>
                              <td className="py-2 text-foreground">{c.unitsSold.toLocaleString()}</td>
                              <td className="py-2 text-foreground">{kes(c.transactionValue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-semibold text-foreground">County activity</h2>
            <p className="mt-1 text-xs text-muted-foreground">All-time, every county with a farmer or an order</p>
            <Card className="mt-4">
              <CardContent className="pt-6">
                {countyActivity.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No county activity yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground">
                          <th scope="col" className="pb-2 font-medium">County</th>
                          <th scope="col" className="pb-2 font-medium">Farmers</th>
                          <th scope="col" className="pb-2 font-medium">Buyers</th>
                          <th scope="col" className="pb-2 font-medium">Orders</th>
                          <th scope="col" className="pb-2 font-medium">Transaction value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {countyActivity.map((c) => (
                          <tr key={c.county} className="border-t border-border">
                            <td className="py-2 text-foreground">{c.county}</td>
                            <td className="py-2 text-muted-foreground">{c.farmerCount.toLocaleString()}</td>
                            <td className="py-2 text-muted-foreground">{c.buyerCount.toLocaleString()}</td>
                            <td className="py-2 text-muted-foreground">{c.orderCount.toLocaleString()}</td>
                            <td className="py-2 text-foreground">{kes(c.transactionValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
