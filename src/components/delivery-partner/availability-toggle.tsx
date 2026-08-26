"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setDeliveryPartnerAvailability } from "@/lib/actions/delivery-partner";
import type { DeliveryAvailabilityStatus } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";

export function AvailabilityToggle({ status }: { status: DeliveryAvailabilityStatus }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isAvailable = status === "AVAILABLE";

  function toggle() {
    const next: DeliveryAvailabilityStatus = isAvailable ? "UNAVAILABLE" : "AVAILABLE";
    startTransition(async () => {
      const result = await setDeliveryPartnerAvailability(next);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        next === "AVAILABLE" ? "You're now available for deliveries" : "You're now unavailable"
      );
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant={isAvailable ? "default" : "outline"} disabled={isPending} onClick={toggle}>
      {isAvailable ? "Available for deliveries" : "Unavailable"}
    </Button>
  );
}
