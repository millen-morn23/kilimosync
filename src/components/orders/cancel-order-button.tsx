"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { cancelOrder } from "@/lib/actions/orders";
import { Button } from "@/components/ui/button";

/**
 * Phase D, checkpoint D3. Shared between the buyer's own order page and
 * AdminOrderStatusActions — cancelOrder() itself derives the caller's role
 * server-side and scopes the write accordingly, so the same button works
 * for both without this component needing to know which one it is.
 * Confirmation follows the existing destructive-action pattern already used
 * for product deletion (src/components/farmer/product-row-actions.tsx).
 */
export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    if (!confirm("Cancel this order? This can't be undone.")) return;
    startTransition(async () => {
      const result = await cancelOrder(orderId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Order cancelled.");
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant="destructive" disabled={isPending} onClick={handleCancel}>
      Cancel order
    </Button>
  );
}
