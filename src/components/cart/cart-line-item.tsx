"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Sprout, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { removeCartItem, updateCartItemQuantity } from "@/lib/actions/cart";
import type { CartLine } from "@/lib/data/cart";
import { Button } from "@/components/ui/button";

export function CartLineItem({ line }: { line: CartLine }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(line.quantity);
  const [isPending, startTransition] = useTransition();

  function commitQuantity(next: number) {
    if (next < line.minOrderQuantity || next > line.quantityAvailable) return;
    setQuantity(next);
    startTransition(async () => {
      const result = await updateCartItemQuantity(line.cartItemId, next);
      if ("error" in result) {
        toast.error(result.error);
        setQuantity(line.quantity);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeCartItem(line.cartItemId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  const exceedsAvailable = quantity > line.quantityAvailable;

  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-border py-4 last:border-0">
      <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-accent/50">
        {line.image ? (
          <Image src={line.image} alt={line.name} fill className="object-cover" unoptimized />
        ) : (
          <Sprout className="size-6 text-primary/60" />
        )}
      </div>

      <div className="min-w-40 flex-1">
        <Link href={`/marketplace/${line.slug}`} className="font-medium text-foreground hover:underline">
          {line.name}
        </Link>
        <p className="text-sm text-muted-foreground">
          {line.farmName} · KES {line.price} / {line.priceUnit}
        </p>
        {!line.isActive ? (
          <p className="mt-1 text-xs text-destructive">
            No longer available — please remove this item to check out
          </p>
        ) : (
          exceedsAvailable && (
            <p className="mt-1 text-xs text-destructive">
              Only {line.quantityAvailable} {line.priceUnit} left — please reduce quantity
            </p>
          )
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="Decrease quantity"
          disabled={isPending || !line.isActive || quantity <= line.minOrderQuantity}
          onClick={() => commitQuantity(quantity - 1)}
        >
          <Minus className="size-3.5" />
        </Button>
        <span className="w-10 text-center text-sm">{quantity}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="Increase quantity"
          disabled={isPending || !line.isActive || quantity >= line.quantityAvailable}
          onClick={() => commitQuantity(quantity + 1)}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      <p className="shrink-0 text-right font-medium text-foreground">
        KES {(line.price * quantity).toFixed(2)}
      </p>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={isPending}
        onClick={remove}
        aria-label="Remove item"
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
