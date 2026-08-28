import Link from "next/link";
import type { Metadata } from "next";
import { PackageSearch } from "lucide-react";

import { getAdminOrders } from "@/lib/data/orders";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/status-badges";
import { AdminOrderStatusActions } from "@/components/admin/order-status-actions";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Orders — Admin" };

export default async function AdminOrdersPage() {
  const orders = await getAdminOrders();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Paid orders, most recent first. Delivery is manually coordinated here for MVP — see
        docs/ROADMAP.md Phase 6 for the planned transporter role.
      </p>

      {orders.length === 0 ? (
        <Card className="mt-8 items-center gap-3 py-16 text-center">
          <PackageSearch className="size-10 text-primary" />
          <p className="max-w-sm text-sm text-muted-foreground">No paid orders yet.</p>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <Link href={`/orders/${order.id}`} className="font-medium text-foreground hover:underline">
                    Order #{order.id.slice(0, 8)}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {order.buyer_name} · {order.delivery_address}, {order.delivery_county} · KES{" "}
                    {order.total_amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleString("en-KE")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <OrderStatusBadge status={order.order_status} />
                  <PaymentStatusBadge status={order.payment_status} />
                  <AdminOrderStatusActions
                    orderId={order.id}
                    orderStatus={order.order_status}
                    delivery={order.delivery}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
