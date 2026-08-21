import Link from "next/link";
import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";

import { getAdminDisputes } from "@/lib/data/disputes";
import { DisputeResolveForm } from "@/components/disputes/dispute-resolve-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Disputes — Admin" };

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "outline"> = {
  open: "warning",
  investigating: "default",
  resolved: "success",
  rejected: "outline",
};

export default async function AdminDisputesPage() {
  const disputes = await getAdminDisputes();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Disputes</h1>
      <p className="mt-2 text-sm text-muted-foreground">Buyer-reported issues on orders, most recent first.</p>

      {disputes.length === 0 ? (
        <Card className="mt-8 items-center gap-3 py-16 text-center">
          <ShieldAlert className="size-10 text-primary" />
          <p className="max-w-sm text-sm text-muted-foreground">No disputes have been reported.</p>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {disputes.map((d) => (
            <Card key={d.id}>
              <CardContent className="space-y-3 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{d.reason}</p>
                    <p className="text-sm text-muted-foreground">
                      {d.buyer_name} ·{" "}
                      <Link href={`/orders/${d.order_id}`} className="hover:underline">
                        Order #{d.order_id.slice(0, 8)}
                      </Link>{" "}
                      · {new Date(d.created_at).toLocaleString("en-KE")}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[d.status] ?? "outline"} className="capitalize">
                    {d.status}
                  </Badge>
                </div>
                <p className="text-sm text-foreground">{d.description}</p>
                {d.admin_response && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Admin response:</span> {d.admin_response}
                  </p>
                )}
                {d.status !== "resolved" && d.status !== "rejected" && (
                  <DisputeResolveForm disputeId={d.id} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
