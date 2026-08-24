"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import type { CreateFarmerProfileInput } from "@/lib/validation/farmer";
import { FarmerProfileForm } from "@/components/farmer/farmer-profile-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function FarmerProfileCard({
  farmName,
  county,
  subcounty,
  location,
  mainCrops,
  farmDescription,
}: {
  farmName: string;
  county: string;
  subcounty: string | null;
  location: string | null;
  mainCrops: string[];
  farmDescription: string | null;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    const defaultValues: CreateFarmerProfileInput = {
      farmName,
      county,
      subcounty: subcounty ?? "",
      location: location ?? "",
      farmDescription: farmDescription ?? "",
      mainCrops: mainCrops.join(", "),
    };
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Edit farm profile</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <FarmerProfileForm defaultValues={defaultValues} onSaved={() => setEditing(false)} />
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
          <CardTitle>{farmName}</CardTitle>
          <CardDescription>
            {county}
            {subcounty ? `, ${subcounty}` : ""}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" />
          Edit
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 pb-6">
        {mainCrops.length > 0 && (
          <p className="text-sm text-muted-foreground">Main crops: {mainCrops.join(", ")}</p>
        )}
        {farmDescription && <p className="text-sm text-foreground">{farmDescription}</p>}
      </CardContent>
    </Card>
  );
}
