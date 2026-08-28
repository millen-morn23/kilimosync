"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateOrderStatus, adminOverrideDeliveryStatus } from "@/lib/actions/orders";
import { Button } from "@/components/ui/button";
import { CancelOrderButton } from "@/components/orders/cancel-order-button";
import type { OrderDeliveryInfo } from "@/lib/data/orders";

const NEXT_STATUS: Record<string, { label: string; status: string } | undefined> = {
  READY_FOR_DELIVERY: { label: "Mark out for delivery", status: "OUT_FOR_DELIVERY" },
  OUT_FOR_DELIVERY: { label: "Mark delivered", status: "DELIVERED" },
  DELIVERED: { label: "Mark completed", status: "COMPLETED" },
};

// The two transitions that touch `deliveries` (Phase D, checkpoint D1) —
// the only ones a claimed delivery can block, and the only ones the admin
// override applies to. "Mark completed" never touches deliveries and is
// unaffected either way by delivery claim state (D2, no change).
const DELIVERY_SYNCED_STATUSES = new Set(["OUT_FOR_DELIVERY", "DELIVERED"]);

export function AdminOrderStatusActions({
  orderId,
  orderStatus,
  delivery,
}: {
  orderId: string;
  orderStatus: string;
  delivery: OrderDeliveryInfo | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Phase D, checkpoint D3: PENDING_PAYMENT has no entry in NEXT_STATUS —
  // cancelOrder() (shared with the buyer's own cancel button) is the only
  // control admin needs for this state.
  if (orderStatus === "PENDING_PAYMENT") {
    return <CancelOrderButton orderId={orderId} />;
  }

  const next = NEXT_STATUS[orderStatus];
  if (!next) return null;

  const claimed = delivery !== null && delivery.transporterId !== null;
  const isOverrideCase = claimed && DELIVERY_SYNCED_STATUSES.has(next.status);

  function advance() {
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, next!.status);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function override() {
    if (
      !confirm(
        `This delivery has already been claimed by a partner. Override it and force "${next!.label}"? This bypasses the partner's own progress and is logged.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await adminOverrideDeliveryStatus(orderId, next!.status);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Delivery overridden.");
      router.refresh();
    });
  }

  if (isOverrideCase) {
    return (
      <Button size="sm" variant="destructive" disabled={isPending} onClick={override}>
        Admin Override
      </Button>
    );
  }

  return (
    <Button size="sm" variant="outline" disabled={isPending} onClick={advance}>
      {next.label}
    </Button>
  );
}
