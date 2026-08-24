import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { getCurrentUser } from "@/lib/data/current-user";
import { getCart } from "@/lib/data/cart";
import { getPlatformFeePercent } from "@/lib/data/platform-settings";
import { FLAT_DELIVERY_FEE_KES } from "@/lib/constants";
import { SiteHeaderContainer } from "@/components/marketing/site-header-container";
import { SiteFooter } from "@/components/marketing/site-footer";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/checkout");
  if (user.role !== "buyer") redirect("/dashboard");

  const [cart, feePercent] = await Promise.all([getCart(), getPlatformFeePercent()]);

  if (cart.lines.length === 0) {
    return (
      <>
        <SiteHeaderContainer />
        <main className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold text-foreground">Your cart is empty</h1>
          <p className="mt-2 text-muted-foreground">
            Add produce to your cart before checking out.
          </p>
          <Button className="mt-6" asChild>
            <Link href="/marketplace">Browse marketplace</Link>
          </Button>
        </main>
        <SiteFooter />
      </>
    );
  }

  const platformFee = Math.round(cart.subtotal * (feePercent / 100) * 100) / 100;
  const total = Math.round((cart.subtotal + platformFee + FLAT_DELIVERY_FEE_KES) * 100) / 100;

  const blockedLines = cart.lines.filter(
    (line) => !line.isActive || line.quantity > line.quantityAvailable
  );

  return (
    <>
      <SiteHeaderContainer />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Checkout</h1>

        {blockedLines.length > 0 && (
          <Card className="mt-6 border-destructive/40 bg-destructive/5">
            <CardContent className="flex items-start gap-3 py-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Fix your cart before checking out</p>
                <p className="mt-1 text-muted-foreground">
                  {blockedLines.map((l) => l.name).join(", ")}{" "}
                  {blockedLines.length === 1 ? "is" : "are"} no longer available in the requested
                  quantity.{" "}
                  <Link href="/cart" className="font-medium text-primary underline">
                    Update your cart
                  </Link>
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <Card className="p-6">
            <CheckoutForm
              disabled={blockedLines.length > 0}
              defaultValues={{
                buyerName: user.name,
                buyerPhone: user.phone ?? "",
                deliveryCounty: user.county ?? "",
              }}
            />
          </Card>

          <Card className="h-fit">
            <CardContent className="space-y-4 pt-6 pb-6">
              <div className="space-y-2">
                {cart.lines.map((line) => (
                  <div key={line.cartItemId} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {line.name} × {line.quantity}
                    </span>
                    <span className="text-foreground">KES {line.lineTotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">KES {cart.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery fee</span>
                  <span className="text-foreground">KES {FLAT_DELIVERY_FEE_KES.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Platform fee ({feePercent}%)</span>
                  <span className="text-foreground">KES {platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
                  <span className="text-foreground">Total</span>
                  <span className="text-foreground">KES {total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
