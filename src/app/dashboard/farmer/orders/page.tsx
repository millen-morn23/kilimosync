import { redirect } from "next/navigation";
import { PackageSearch } from "lucide-react";

import { getCurrentUser, getOwnFarmerProfile } from "@/lib/data/current-user";
import { getFarmerOrders } from "@/lib/data/orders";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/status-badges";
import { FarmerOrderStatusActions } from "@/components/farmer/farmer-order-status-actions";
import { Card, CardContent } from "@/components/ui/card";

export default async function FarmerOrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "farmer") redirect("/dashboard");

  const farmerProfile = await getOwnFarmerProfile();
  const orders = farmerProfile ? await getFarmerOrders(farmerProfile.id) : [];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Orders containing your products. Move a paid order to &quot;Preparing&quot; and then
        &quot;Ready for delivery&quot; — an admin takes it from there.
      </p>

      {orders.length === 0 ? (
        <Card className="mt-8 items-center gap-3 py-16 text-center">
          <PackageSearch className="size-10 text-primary" />
          <p className="max-w-sm text-sm text-muted-foreground">
            No orders yet. Orders for your products will appear here.
          </p>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((order) => (
            <Card key={order.orderId}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium text-foreground">
                    {order.items.map((item) => `${item.productName} × ${item.quantity}`).join(", ")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {order.buyerName} · {new Date(order.orderCreatedAt).toLocaleString("en-KE")} · KES{" "}
                    {order.total.toFixed(2)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <OrderStatusBadge status={order.orderStatus} />
                  <PaymentStatusBadge status={order.paymentStatus} />
                  <FarmerOrderStatusActions orderId={order.orderId} orderStatus={order.orderStatus} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
