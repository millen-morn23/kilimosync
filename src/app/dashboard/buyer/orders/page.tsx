import Link from "next/link";
import { ShoppingBasket } from "lucide-react";

import { getBuyerOrders } from "@/lib/data/orders";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/status-badges";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function BuyerOrdersPage() {
  const orders = await getBuyerOrders();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Your orders</h1>

      {orders.length === 0 ? (
        <Card className="mt-8 items-center gap-3 py-16 text-center">
          <ShoppingBasket className="size-10 text-primary" />
          <p className="max-w-sm text-sm text-muted-foreground">
            You haven&apos;t placed any orders yet.
          </p>
          <Button asChild>
            <Link href="/marketplace">Browse marketplace</Link>
          </Button>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-medium text-foreground">
                      Order #{order.id.slice(0, 8)} · {order.itemCount} item
                      {order.itemCount === 1 ? "" : "s"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.created_at).toLocaleString("en-KE")} · KES{" "}
                      {order.total_amount.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <OrderStatusBadge status={order.order_status} />
                    <PaymentStatusBadge status={order.payment_status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
