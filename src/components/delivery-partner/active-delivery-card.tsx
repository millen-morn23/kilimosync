"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { advanceDeliveryStatus, markDeliveryFailed, releaseClaim } from "@/lib/actions/delivery-partner";
import type { ActiveDelivery } from "@/lib/data/current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ActionResult = { error: string } | { success: true };

const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: "Assigned",
  PICKED_UP: "Picked up",
  IN_TRANSIT: "In transit",
};

const NEXT_STATUS: Record<string, { label: string; status: "PICKED_UP" | "IN_TRANSIT" | "DELIVERED" } | undefined> = {
  ASSIGNED: { label: "Mark picked up", status: "PICKED_UP" },
  PICKED_UP: { label: "Mark in transit", status: "IN_TRANSIT" },
  IN_TRANSIT: { label: "Mark delivered", status: "DELIVERED" },
};

export function ActiveDeliveryCard({ delivery }: { delivery: ActiveDelivery }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const next = NEXT_STATUS[delivery.status];

  function run(action: () => Promise<ActionResult>, successMessage: string) {
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(successMessage);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{STATUS_LABEL[delivery.status] ?? delivery.status}</Badge>
        </div>
        <div>
          <p className="font-medium text-foreground">
            {delivery.buyerName} · {delivery.buyerPhone}
          </p>
          <p className="text-sm text-muted-foreground">
            {delivery.deliveryAddress}
            {delivery.deliveryNotes ? ` · ${delivery.deliveryNotes}` : ""}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Pickup: {delivery.pickupLocation}</p>
        <p className="text-sm text-muted-foreground">
          Delivery fee: KES {delivery.deliveryFee.toFixed(2)}
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          {next && (
            <Button
              size="sm"
              disabled={isPending}
              onClick={() =>
                run(() => advanceDeliveryStatus(delivery.id, next.status), "Delivery updated.")
              }
            >
              {next.label}
            </Button>
          )}
          {delivery.status === "ASSIGNED" && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => run(() => releaseClaim(delivery.id), "Delivery released back to the pool.")}
            >
              Release
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => markDeliveryFailed(delivery.id), "Delivery marked as failed.")}
          >
            Report a problem
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
