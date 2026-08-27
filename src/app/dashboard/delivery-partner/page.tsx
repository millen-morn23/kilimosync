import { redirect } from "next/navigation";

import {
  getActiveDelivery,
  getAvailableDeliveryJobs,
  getCurrentUser,
  getOwnDeliveryPartnerProfile,
} from "@/lib/data/current-user";
import { DeliveryPartnerProfileForm } from "@/components/delivery-partner/profile-form";
import { DeliveryPartnerProfileCard } from "@/components/delivery-partner/profile-card";
import { AvailabilityToggle } from "@/components/delivery-partner/availability-toggle";
import { AvailableJobsList } from "@/components/delivery-partner/available-jobs-list";
import { ActiveDeliveryCard } from "@/components/delivery-partner/active-delivery-card";
import { VerificationBadge } from "@/components/farmer/verification-badge";
import { Card, CardContent } from "@/components/ui/card";

export default async function DeliveryPartnerDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "delivery_partner") redirect("/dashboard");

  const profile = await getOwnDeliveryPartnerProfile();
  const isVerified = profile?.verification_status === "verified";
  const [availableJobs, activeDelivery] = await Promise.all([
    isVerified ? getAvailableDeliveryJobs() : Promise.resolve([]),
    isVerified ? getActiveDelivery() : Promise.resolve(null),
  ]);

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-foreground">Set up your delivery partner profile</h1>
        <p className="mt-2 text-muted-foreground">
          Tell us how you get around so we can match you with nearby
          deliveries. Once submitted, your application is reviewed for
          verification.
        </p>
        <Card className="mt-8">
          <CardContent className="pt-6">
            <DeliveryPartnerProfileForm />
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
        <div className="flex items-center gap-3">
          <VerificationBadge status={profile.verification_status} />
          {profile.verification_status === "verified" && (
            <AvailabilityToggle status={profile.availability_status} />
          )}
        </div>
      </div>

      {profile.verification_status === "pending" && (
        <p className="mt-2 text-muted-foreground">
          Your application is awaiting admin review. Deliveries will appear
          here once you&apos;re verified.
        </p>
      )}
      {profile.verification_status === "rejected" && (
        <p className="mt-2 text-muted-foreground">
          Your application wasn&apos;t approved. You can update your details
          below and it will be reviewed again.
        </p>
      )}
      {profile.verification_status === "verified" && activeDelivery && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-foreground">Active delivery</h2>
          <div className="mt-3">
            <ActiveDeliveryCard delivery={activeDelivery} />
          </div>
        </div>
      )}

      {profile.verification_status === "verified" && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-foreground">Available jobs</h2>
          {profile.availability_status === "AVAILABLE" ? (
            <div className="mt-3">
              <AvailableJobsList jobs={availableJobs} />
            </div>
          ) : (
            <p className="mt-2 text-muted-foreground">
              Set yourself to available above to see delivery jobs in your area.
            </p>
          )}
        </div>
      )}

      <DeliveryPartnerProfileCard
        vehicleType={profile.vehicle_type}
        vehicleRegistration={profile.vehicle_registration}
        operatingCounty={profile.operating_county}
      />
    </div>
  );
}
