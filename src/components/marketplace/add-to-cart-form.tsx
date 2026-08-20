"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { addToCart } from "@/lib/actions/cart";
import { Button } from "@/components/ui/button";

export function AddToCartForm({
  productId,
  minOrderQuantity,
  quantityAvailable,
  quantityUnit,
  isAuthenticated,
}: {
  productId: string;
  minOrderQuantity: number;
  quantityAvailable: number;
  quantityUnit: string;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(minOrderQuantity);
  const [isPending, startTransition] = useTransition();

  const soldOut = quantityAvailable <= 0;

  function add() {
    if (!isAuthenticated) {
      router.push("/login?next=/marketplace");
      return;
    }
    startTransition(async () => {
      const result = await addToCart(productId, quantity);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Added to cart");
      router.push("/cart");
    });
  }

  if (soldOut) {
    return (
      <Button size="lg" className="mt-8" disabled>
        Sold out
      </Button>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={quantity <= minOrderQuantity}
            onClick={() => setQuantity((q) => Math.max(minOrderQuantity, q - minOrderQuantity))}
          >
            <Minus className="size-4" />
          </Button>
          <span className="w-16 text-center text-sm font-medium">
            {quantity} {quantityUnit}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={quantity + minOrderQuantity > quantityAvailable}
            onClick={() => setQuantity((q) => Math.min(quantityAvailable, q + minOrderQuantity))}
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          Min. order {minOrderQuantity} {quantityUnit}
        </span>
      </div>

      <Button size="lg" disabled={isPending} onClick={add}>
        {isPending ? "Adding…" : "Add to cart"}
      </Button>
    </div>
  );
}
