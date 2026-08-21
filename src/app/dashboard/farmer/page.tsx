import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, Package, Plus, Sparkles } from "lucide-react";

import { getCurrentUser, getOwnFarmerProfile } from "@/lib/data/current-user";
import { getOwnFarmerProducts } from "@/lib/data/products";
import { getFarmerOrderLines } from "@/lib/data/orders";
import { FarmerProfileForm } from "@/components/farmer/farmer-profile-form";
import { VerificationBadge } from "@/components/farmer/verification-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function FarmerDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "farmer") redirect("/dashboard");

  const farmerProfile = await getOwnFarmerProfile();

  if (!farmerProfile) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-foreground">Set up your farm profile</h1>
        <p className="mt-2 text-muted-foreground">
          Tell buyers about your farm. Once submitted, your profile is
          reviewed for verification.
        </p>
        <Card className="mt-8">
          <CardContent className="pt-6">
            <FarmerProfileForm />
          </CardContent>
        </Card>
      </div>
    );
  }

  const [products, orderLines] = await Promise.all([
    getOwnFarmerProducts(farmerProfile.id),
    getFarmerOrderLines(farmerProfile.id),
  ]);

  const activeListings = products.filter((p) => p.status === "active").length;
  const distinctOrders = new Set(orderLines.map((l) => l.orderId)).size;
  const totalSales = orderLines
    .filter((l) => l.paymentStatus === "PAID")
    .reduce((sum, l) => sum + l.subtotal, 0);

  const stats = [
    { label: "Active listings", value: activeListings },
    { label: "Orders received", value: distinctOrders },
    { label: "Total sales", value: `KES ${totalSales.toFixed(2)}` },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome, {user.name.split(" ")[0]}
        </h1>
        <VerificationBadge status={farmerProfile.verification_status} />
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/dashboard/farmer/products/new">
            <Plus />
            Add produce
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/farmer/products">
            <Package />
            Manage products
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/farmer/orders">
            <ClipboardList />
            View orders
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/assistant">
            <Sparkles />
            Ask KilimoSync AI
          </Link>
        </Button>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{farmerProfile.farm_name}</CardTitle>
          <CardDescription>
            {farmerProfile.county}
            {farmerProfile.subcounty ? `, ${farmerProfile.subcounty}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pb-6">
          {farmerProfile.main_crops.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Main crops: {farmerProfile.main_crops.join(", ")}
            </p>
          )}
          {farmerProfile.farm_description && (
            <p className="text-sm text-foreground">{farmerProfile.farm_description}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
