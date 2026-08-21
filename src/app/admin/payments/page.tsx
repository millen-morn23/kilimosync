import Link from "next/link";
import type { Metadata } from "next";
import { Receipt } from "lucide-react";

import { getPaymentStats, getRecentPayments } from "@/lib/data/payments";
import { PaymentStatusBadge } from "@/components/orders/status-badges";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Payments — Admin" };

export default async function AdminPaymentsPage() {
  const [stats, payments] = await Promise.all([getPaymentStats(), getRecentPayments()]);

  const statCards = [
    { label: "Successful payments", value: stats.paid },
    { label: "Pending / in flight", value: stats.pendingOrInFlight },
    { label: "Failed payments", value: stats.failed },
    { label: "Gross transaction value", value: `KES ${stats.grossTransactionValue.toFixed(2)}` },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Payments</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every M-PESA payment record, most recent first. Receipt numbers only appear once
        Safaricom has confirmed the payment — nothing here is fabricated.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {payments.length === 0 ? (
        <Card className="mt-8 items-center gap-3 py-16 text-center">
          <Receipt className="size-10 text-primary" />
          <p className="max-w-sm text-sm text-muted-foreground">No payments recorded yet.</p>
        </Card>
      ) : (
        <div className="mt-8 space-y-3">
          {payments.map((payment) => (
            <Card key={payment.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <Link
                    href={`/orders/${payment.order_id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    Order #{payment.order_id.slice(0, 8)}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {payment.phone_number} · KES {payment.amount.toFixed(2)} ·{" "}
                    {new Date(payment.created_at).toLocaleString("en-KE")}
                  </p>
                  {payment.mpesa_receipt_number && (
                    <p className="text-xs text-muted-foreground">
                      Receipt: {payment.mpesa_receipt_number}
                    </p>
                  )}
                  {payment.result_description && payment.status !== "PAID" && (
                    <p className="text-xs text-muted-foreground">{payment.result_description}</p>
                  )}
                </div>
                <PaymentStatusBadge status={payment.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
