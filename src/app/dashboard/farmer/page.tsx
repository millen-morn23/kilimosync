import { redirect } from "next/navigation";
import { Sprout } from "lucide-react";

import { getCurrentUser, getOwnFarmerProfile } from "@/lib/data/current-user";
import { FarmerProfileForm } from "@/components/farmer/farmer-profile-form";
import { VerificationBadge } from "@/components/farmer/verification-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome, {user.name.split(" ")[0]}
        </h1>
        <VerificationBadge status={farmerProfile.verification_status} />
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

      <Card className="mt-6 items-center gap-3 py-12 text-center">
        <Sprout className="size-8 text-primary" />
        <p className="max-w-sm text-sm text-muted-foreground">
          Product listings, orders and sales analytics are launching in the
          next development phase.
        </p>
      </Card>
    </div>
  );
}
