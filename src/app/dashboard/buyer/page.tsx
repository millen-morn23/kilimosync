import { redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardList, ShoppingBasket, ShoppingCart, Sparkles } from "lucide-react";

import { getCurrentUser } from "@/lib/data/current-user";
import { getBuyerOrders } from "@/lib/data/orders";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/status-badges";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function BuyerDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "buyer") redirect("/dashboard");

  const orders = await getBuyerOrders();
  const recentOrders = orders.slice(0, 3);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">
        Welcome, {user.name.split(" ")[0]}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {user.county ? `${user.county} · ` : ""}
        {user.email}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/marketplace">
            <ShoppingBasket />
            Browse marketplace
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/cart">
            <ShoppingCart />
            View cart
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/buyer/orders">
            <ClipboardList />
            Order history
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/assistant">
            <Sparkles />
            Ask KilimoSync AI
          </Link>
        </Button>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">Recent orders</h2>
        {recentOrders.length === 0 ? (
          <Card className="mt-4 items-center gap-3 py-12 text-center">
            <ShoppingBasket className="size-8 text-primary" />
            <p className="max-w-sm text-sm text-muted-foreground">
              You haven&apos;t placed any orders yet.
            </p>
          </Card>
        ) : (
          <div className="mt-4 space-y-3">
            {recentOrders.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <p className="font-medium text-foreground">
                        Order #{order.id.slice(0, 8)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        KES {order.total_amount.toFixed(2)}
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
    </div>
  );
}
