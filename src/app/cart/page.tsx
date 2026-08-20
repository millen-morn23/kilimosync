import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingBasket } from "lucide-react";

import { getCurrentUser } from "@/lib/data/current-user";
import { getCart } from "@/lib/data/cart";
import { getPlatformFeePercent } from "@/lib/data/platform-settings";
import { FLAT_DELIVERY_FEE_KES } from "@/lib/constants";
import { SiteHeaderContainer } from "@/components/marketing/site-header-container";
import { SiteFooter } from "@/components/marketing/site-footer";
import { CartLineItem } from "@/components/cart/cart-line-item";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Your Cart" };

export default async function CartPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/cart");
  if (user.role !== "buyer") redirect("/dashboard");

  const [cart, feePercent] = await Promise.all([getCart(), getPlatformFeePercent()]);
  const platformFee = Math.round(cart.subtotal * (feePercent / 100) * 100) / 100;
  const deliveryFee = cart.lines.length > 0 ? FLAT_DELIVERY_FEE_KES : 0;
  const total = Math.round((cart.subtotal + platformFee + deliveryFee) * 100) / 100;

  return (
    <>
      <SiteHeaderContainer />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Your cart</h1>

        {cart.lines.length === 0 ? (
          <Card className="mt-8 items-center gap-3 py-20 text-center">
            <ShoppingBasket className="size-10 text-primary" />
            <p className="max-w-sm text-sm text-muted-foreground">
              Your cart is empty. Browse the marketplace to find fresh produce.
            </p>
            <Button asChild>
              <Link href="/marketplace">Browse marketplace</Link>
            </Button>
          </Card>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
            <Card className="p-6">
              {cart.lines.map((line) => (
                <CartLineItem key={line.cartItemId} line={line} />
              ))}
            </Card>

            <Card className="h-fit">
              <CardContent className="space-y-3 pt-6 pb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">KES {cart.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery fee</span>
                  <span className="text-foreground">KES {deliveryFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Platform fee ({feePercent}%)</span>
                  <span className="text-foreground">KES {platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
                  <span className="text-foreground">Total</span>
                  <span className="text-foreground">KES {total.toFixed(2)}</span>
                </div>
                <Button className="w-full" size="lg" asChild>
                  <Link href="/checkout">Proceed to checkout</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
