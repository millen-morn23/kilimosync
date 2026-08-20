import { redirect } from "next/navigation";
import { PackageSearch } from "lucide-react";

import { getCurrentUser, getOwnFarmerProfile } from "@/lib/data/current-user";
import { getFarmerOrderLines } from "@/lib/data/orders";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/status-badges";
import { Card, CardContent } from "@/components/ui/card";

export default async function FarmerOrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "farmer") redirect("/dashboard");

  const farmerProfile = await getOwnFarmerProfile();
  const lines = farmerProfile ? await getFarmerOrderLines(farmerProfile.id) : [];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Orders containing your products. Order status updates once M-PESA
        payment integration ships — see docs/ROADMAP.md.
      </p>

      {lines.length === 0 ? (
        <Card className="mt-8 items-center gap-3 py-16 text-center">
          <PackageSearch className="size-10 text-primary" />
          <p className="max-w-sm text-sm text-muted-foreground">
            No orders yet. Orders for your products will appear here.
          </p>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {lines.map((line, i) => (
            <Card key={`${line.orderId}-${i}`}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium text-foreground">
                    {line.productName} × {line.quantity}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {line.buyerName} · {new Date(line.orderCreatedAt).toLocaleString("en-KE")} ·
                    KES {line.subtotal.toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <OrderStatusBadge status={line.orderStatus} />
                  <PaymentStatusBadge status={line.paymentStatus} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
