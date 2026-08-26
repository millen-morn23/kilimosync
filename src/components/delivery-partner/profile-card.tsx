"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import type { CreateDeliveryPartnerProfileInput } from "@/lib/validation/delivery-partner";
import type { VehicleType } from "@/lib/supabase/types";
import { DeliveryPartnerProfileForm } from "@/components/delivery-partner/profile-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  bicycle: "Bicycle",
  motorbike: "Motorbike",
  car: "Car",
  van: "Van",
  on_foot: "On foot",
};

export function DeliveryPartnerProfileCard({
  vehicleType,
  vehicleRegistration,
  operatingCounty,
}: {
  vehicleType: VehicleType;
  vehicleRegistration: string | null;
  operatingCounty: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    const defaultValues: CreateDeliveryPartnerProfileInput = {
      vehicleType,
      vehicleRegistration: vehicleRegistration ?? "",
      operatingCounty,
    };
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Edit delivery partner profile</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <DeliveryPartnerProfileForm defaultValues={defaultValues} onSaved={() => setEditing(false)} />
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>{VEHICLE_TYPE_LABELS[vehicleType]}</CardTitle>
          <CardDescription>Operating in {operatingCounty}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" />
          Edit
        </Button>
      </CardHeader>
      {vehicleRegistration && (
        <CardContent className="pb-6">
          <p className="text-sm text-muted-foreground">Registration: {vehicleRegistration}</p>
        </CardContent>
      )}
    </Card>
  );
}
