"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateOrderStatus } from "@/lib/actions/orders";
import { Button } from "@/components/ui/button";

const NEXT_STATUS: Record<string, { label: string; status: string } | undefined> = {
  CONFIRMED: { label: "Start preparing", status: "PREPARING" },
  PREPARING: { label: "Mark ready for delivery", status: "READY_FOR_DELIVERY" },
};

export function FarmerOrderStatusActions({ orderId, orderStatus }: { orderId: string; orderStatus: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const next = NEXT_STATUS[orderStatus];
  if (!next) return null;

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

  return (
    <Button size="sm" variant="outline" disabled={isPending} onClick={advance}>
      {next.label}
    </Button>
  );
}
