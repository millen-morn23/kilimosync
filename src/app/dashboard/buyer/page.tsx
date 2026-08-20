import { redirect } from "next/navigation";
import Link from "next/link";
import { ShoppingBasket } from "lucide-react";

import { getCurrentUser } from "@/lib/data/current-user";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function BuyerDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "buyer") redirect("/dashboard");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">
        Welcome, {user.name.split(" ")[0]}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {user.county ? `${user.county} · ` : ""}
        {user.email}
      </p>

      <Card className="mt-8 items-center gap-3 py-16 text-center">
        <ShoppingBasket className="size-10 text-primary" />
        <p className="max-w-sm text-sm text-muted-foreground">
          Browsing the marketplace, your cart and order history are launching
          in the next development phase.
        </p>
        <Button asChild>
          <Link href="/marketplace">Preview marketplace</Link>
        </Button>
      </Card>
    </div>
  );
}
