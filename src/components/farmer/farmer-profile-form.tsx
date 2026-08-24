"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createFarmerProfile, updateFarmerProfile } from "@/lib/actions/farmer";
import { createFarmerProfileSchema, type CreateFarmerProfileInput } from "@/lib/validation/farmer";
import { KENYAN_COUNTIES } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FarmerProfileForm({
  defaultValues,
  onSaved,
}: {
  defaultValues?: Partial<CreateFarmerProfileInput>;
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
  } = useForm<CreateFarmerProfileInput>({
    resolver: zodResolver(createFarmerProfileSchema),
    defaultValues,
  });

  async function onSubmit(values: CreateFarmerProfileInput) {
    setSubmitting(true);
    const result = isEdit ? await updateFarmerProfile(values) : await createFarmerProfile(values);
    setSubmitting(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "Farm profile updated" : "Farm profile created — pending verification");
    router.refresh();
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="farmName">Farm name</Label>
        <Input id="farmName" {...register("farmName")} />
        {errors.farmName && (
          <p className="text-sm text-destructive">{errors.farmName.message}</p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="county">County</Label>
          <Controller
            control={control}
            name="county"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="county">
                  <SelectValue placeholder="Select county" />
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
          {errors.county && (
            <p className="text-sm text-destructive">{errors.county.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="subcounty">Sub-county (optional)</Label>
          <Input id="subcounty" {...register("subcounty")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Farm location (optional)</Label>
        <Input id="location" placeholder="e.g. Along Thika Road, near Ruiru" {...register("location")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="mainCrops">Main crops</Label>
        <Input id="mainCrops" placeholder="Tomatoes, kale, onions" {...register("mainCrops")} />
        {errors.mainCrops && (
          <p className="text-sm text-destructive">{errors.mainCrops.message}</p>
        )}
        <p className="text-xs text-muted-foreground">Separate crops with commas.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="farmDescription">About your farm (optional)</Label>
        <Textarea id="farmDescription" rows={4} {...register("farmDescription")} />
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : isEdit ? "Save changes" : "Create farm profile"}
      </Button>
    </form>
  );
}
