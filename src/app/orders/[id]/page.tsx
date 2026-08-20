import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Info } from "lucide-react";

import { getCurrentUser } from "@/lib/data/current-user";
import { getOrderDetail } from "@/lib/data/orders";
import { SiteHeaderContainer } from "@/components/marketing/site-header-container";
import { SiteFooter } from "@/components/marketing/site-footer";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/status-badges";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/orders/${id}`);

  const order = await getOrderDetail(id);
  if (!order) notFound();

  return (
    <>
      <SiteHeaderContainer />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-foreground">
            Order #{order.id.slice(0, 8)}
          </h1>
          <div className="flex gap-2">
            <OrderStatusBadge status={order.order_status} />
            <PaymentStatusBadge status={order.payment_status} />
          </div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Placed {new Date(order.created_at).toLocaleString("en-KE")}
        </p>

        {order.payment_status === "PENDING" && (
          <Card className="mt-6 border-warning/30 bg-warning/5">
            <CardContent className="flex gap-3 py-4">
              <Info className="mt-0.5 size-5 shrink-0 text-warning" />
              <p className="text-sm text-foreground">
                M-PESA payment isn&apos;t connected yet in this build — your
                order is saved, but checkout can&apos;t take payment until
                that ships. Nothing has been charged.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardContent className="space-y-4 pt-6 pb-6">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.product_name_snapshot} × {item.quantity}
                </span>
                <span className="text-foreground">KES {item.subtotal.toFixed(2)}</span>
              </div>
            ))}
            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground">KES {order.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery fee</span>
                <span className="text-foreground">KES {order.delivery_fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform fee</span>
                <span className="text-foreground">KES {order.platform_fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
                <span className="text-foreground">Total</span>
                <span className="text-foreground">KES {order.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardContent className="space-y-1 pt-6 pb-6 text-sm">
            <p className="font-medium text-foreground">Delivery details</p>
            <p className="text-muted-foreground">{order.buyer_name} · {order.buyer_phone}</p>
            <p className="text-muted-foreground">
              {order.delivery_address}, {order.delivery_county}
            </p>
            {order.delivery_notes && (
              <p className="text-muted-foreground">Note: {order.delivery_notes}</p>
            )}
          </CardContent>
        </Card>

        <Button variant="outline" className="mt-6" asChild>
          <Link href="/marketplace">Continue shopping</Link>
        </Button>
      </main>
      <SiteFooter />
    </>
  );
}
