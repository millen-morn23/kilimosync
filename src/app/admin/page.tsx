import Link from "next/link";
import { BarChart3, ClipboardList, Receipt, ShieldAlert, Sparkles } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getPaymentStats } from "@/lib/data/payments";
import { PendingFarmersList } from "@/components/admin/pending-farmers-list";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [
    { count: totalUsers },
    { count: farmers },
    { count: buyers },
    { count: verifiedFarmers },
    { count: openDisputes },
    pendingFarmersRes,
    paymentStats,
  ] = await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }),
      supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "farmer"),
      supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "buyer"),
      supabase
        .from("farmer_profiles")
        .select("*", { count: "exact", head: true })
        .eq("verification_status", "verified"),
      supabase
        .from("disputes")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "investigating"]),
      supabase
        .from("farmer_profiles")
        .select("id, farm_name, county, main_crops, created_at, users(name, email)")
        .eq("verification_status", "pending")
        .order("created_at", { ascending: true }),
      getPaymentStats(),
    ]);

  const stats = [
    { label: "Total users", value: totalUsers ?? 0 },
    { label: "Farmers", value: farmers ?? 0 },
    { label: "Buyers", value: buyers ?? 0 },
    { label: "Verified farmers", value: verifiedFarmers ?? 0 },
    { label: "Successful payments", value: paymentStats.paid },
    { label: "Failed payments", value: paymentStats.failed },
    { label: "Gross transaction value", value: `KES ${paymentStats.grossTransactionValue.toFixed(2)}` },
    { label: "Open disputes", value: openDisputes ?? 0 },
  ];

  const pendingFarmers = (pendingFarmersRes.data ?? []).map((f) => ({
    ...f,
    users: Array.isArray(f.users) ? f.users[0] ?? null : f.users,
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Admin overview</h1>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-accent/30 p-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Full analytics</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Orders and revenue over time, top products and categories, county activity, and user
            growth — filterable by period, county, category, and order status.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/analytics">
            <BarChart3 />
            View analytics
          </Link>
        </Button>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">Farmer verification queue</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review new farm profiles before they receive a verified badge.
        </p>
        <div className="mt-4">
          <PendingFarmersList farmers={pendingFarmers} />
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Payments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            M-PESA reconciliation — successful, failed, and pending payments.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/payments">
            <Receipt />
            View all payments
          </Link>
        </Button>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">KilimoSync AI</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask about platform-wide activity in plain language.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/assistant">
            <Sparkles />
            Open assistant
          </Link>
        </Button>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Orders &amp; delivery</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Coordinate delivery for paid orders — see docs/ROADMAP.md Phase 6 for the planned
            transporter role.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/orders">
            <ClipboardList />
            View orders
          </Link>
        </Button>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Disputes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Buyer-reported issues that need a response.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/disputes">
            <ShieldAlert />
            View disputes
          </Link>
        </Button>
      </div>

      <Card className="mt-10">
        <CardContent className="py-8 text-sm text-muted-foreground">
          Standalone product management (editing/removing any farmer&apos;s listing
          as an admin) is not yet built — see docs/ROADMAP.md.
        </CardContent>
      </Card>
    </div>
  );
}
