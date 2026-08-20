"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deleteProduct, setProductStatus } from "@/lib/actions/product";
import { Button } from "@/components/ui/button";

export function ProductRowActions({
  productId,
  status,
}: {
  productId: string;
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggleStatus() {
    const next = status === "active" ? "paused" : "active";
    startTransition(async () => {
      const result = await setProductStatus(productId, next);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    if (!confirm("Delete this listing? This can't be undone.")) return;
    startTransition(async () => {
      const result = await deleteProduct(productId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Listing deleted");
      router.refresh();
    });
  }

  if (status === "sold_out" || status === "deleted") {
    return (
      <Button variant="ghost" size="sm" disabled={isPending} onClick={remove}>
        Delete
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" disabled={isPending} onClick={toggleStatus}>
        {status === "active" ? "Pause" : "Resume"}
      </Button>
      <Button variant="ghost" size="sm" disabled={isPending} onClick={remove}>
        Delete
      </Button>
    </div>
  );
}
