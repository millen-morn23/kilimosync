import { createClient } from "@/lib/supabase/server";
import { PendingFarmersList } from "@/components/admin/pending-farmers-list";
import { Card, CardContent } from "@/components/ui/card";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [{ count: totalUsers }, { count: farmers }, { count: buyers }, { count: verifiedFarmers }, pendingFarmersRes] =
    await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }),
      supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "farmer"),
      supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "buyer"),
      supabase
        .from("farmer_profiles")
        .select("*", { count: "exact", head: true })
        .eq("verification_status", "verified"),
      supabase
        .from("farmer_profiles")
        .select("id, farm_name, county, main_crops, created_at, users(name, email)")
        .eq("verification_status", "pending")
        .order("created_at", { ascending: true }),
    ]);

  const stats = [
    { label: "Total users", value: totalUsers ?? 0 },
    { label: "Farmers", value: farmers ?? 0 },
    { label: "Buyers", value: buyers ?? 0 },
    { label: "Verified farmers", value: verifiedFarmers ?? 0 },
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

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">Farmer verification queue</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review new farm profiles before they receive a verified badge.
        </p>
        <div className="mt-4">
          <PendingFarmersList farmers={pendingFarmers} />
        </div>
      </div>

      <Card className="mt-10">
        <CardContent className="py-8 text-sm text-muted-foreground">
          Product, order, payment and dispute management are launching in
          upcoming development phases (see docs/ROADMAP.md).
        </CardContent>
      </Card>
    </div>
  );
}
