"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { rejectDeliveryPartner, verifyDeliveryPartner } from "@/lib/actions/admin";
import type { VehicleType } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  bicycle: "Bicycle",
  motorbike: "Motorbike",
  car: "Car",
  van: "Van",
  on_foot: "On foot",
};

type PendingDeliveryPartner = {
  id: string;
  vehicle_type: VehicleType;
  vehicle_registration: string | null;
  operating_county: string;
  created_at: string;
  users: { name: string; email: string } | null;
};

export function PendingDeliveryPartnersList({
  partners,
}: {
  partners: PendingDeliveryPartner[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handle(action: typeof verifyDeliveryPartner, profileId: string) {
    setPendingId(profileId);
    startTransition(async () => {
      const result = await action(profileId);
      setPendingId(null);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Delivery partner status updated");
      router.refresh();
    });
  }

  if (partners.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No delivery partners awaiting verification.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {partners.map((partner) => (
        <Card key={partner.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div>
              <p className="font-medium text-foreground">
                {VEHICLE_TYPE_LABELS[partner.vehicle_type]}
                {partner.vehicle_registration ? ` · ${partner.vehicle_registration}` : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                {partner.users?.name} · {partner.users?.email} · {partner.operating_county}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isPending && pendingId === partner.id}
                onClick={() => handle(rejectDeliveryPartner, partner.id)}
              >
                Reject
              </Button>
              <Button
                size="sm"
                disabled={isPending && pendingId === partner.id}
                onClick={() => handle(verifyDeliveryPartner, partner.id)}
              >
                Verify
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
