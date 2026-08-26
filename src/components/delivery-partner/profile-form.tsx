"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createDeliveryPartnerProfile,
  updateDeliveryPartnerProfile,
} from "@/lib/actions/delivery-partner";
import {
  VEHICLE_TYPES,
  createDeliveryPartnerProfileSchema,
  type CreateDeliveryPartnerProfileInput,
} from "@/lib/validation/delivery-partner";
import { KENYAN_COUNTIES } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VEHICLE_TYPE_LABELS: Record<(typeof VEHICLE_TYPES)[number], string> = {
  bicycle: "Bicycle",
  motorbike: "Motorbike",
  car: "Car",
  van: "Van",
  on_foot: "On foot",
};

export function DeliveryPartnerProfileForm({
  defaultValues,
  onSaved,
}: {
  defaultValues?: Partial<CreateDeliveryPartnerProfileInput>;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(defaultValues);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateDeliveryPartnerProfileInput>({
    resolver: zodResolver(createDeliveryPartnerProfileSchema),
    defaultValues,
  });

  async function onSubmit(values: CreateDeliveryPartnerProfileInput) {
    setSubmitting(true);
    const result = isEdit
      ? await updateDeliveryPartnerProfile(values)
      : await createDeliveryPartnerProfile(values);
    setSubmitting(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(
      isEdit ? "Delivery partner profile updated" : "Application submitted — pending verification"
    );
    router.refresh();
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="vehicleType">Vehicle type</Label>
          <Controller
            control={control}
            name="vehicleType"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="vehicleType">
                  <SelectValue placeholder="Select vehicle type" />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {VEHICLE_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.vehicleType && (
            <p className="text-sm text-destructive">{errors.vehicleType.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="vehicleRegistration">Vehicle registration</Label>
          <Input
            id="vehicleRegistration"
            placeholder="e.g. KDA 123A"
            {...register("vehicleRegistration")}
          />
          <p className="text-xs text-muted-foreground">
            Required for motorbike, car, or van — not needed for bicycle or on foot.
          </p>
          {errors.vehicleRegistration && (
            <p className="text-sm text-destructive">{errors.vehicleRegistration.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="operatingCounty">Operating county</Label>
        <Controller
          control={control}
          name="operatingCounty"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger id="operatingCounty">
                <SelectValue placeholder="Select the county you deliver in" />
              </SelectTrigger>
              <SelectContent>
                {KENYAN_COUNTIES.map((county) => (
                  <SelectItem key={county} value={county}>
                    {county}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.operatingCounty && (
          <p className="text-sm text-destructive">{errors.operatingCounty.message}</p>
        )}
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : isEdit ? "Save changes" : "Submit application"}
      </Button>
    </form>
  );
}
