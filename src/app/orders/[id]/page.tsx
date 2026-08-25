import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Info, XCircle } from "lucide-react";

import { getCurrentUser, getOwnFarmerProfile } from "@/lib/data/current-user";
import { getOrderDetail } from "@/lib/data/orders";
import { getOrderPayment } from "@/lib/data/payments";
import { getReviewedOrderItemIds } from "@/lib/data/reviews";
import { getDisputeForOrder } from "@/lib/data/disputes";
import { isMpesaConfigured } from "@/lib/mpesa/config";
import { SiteHeaderContainer } from "@/components/marketing/site-header-container";
import { SiteFooter } from "@/components/marketing/site-footer";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/status-badges";
import { PayWithMpesa } from "@/components/checkout/pay-with-mpesa";
import { OrderReceipt } from "@/components/checkout/order-receipt";
import { ReviewForm } from "@/components/reviews/review-form";
import { DisputeForm } from "@/components/disputes/dispute-form";
import { DisputeStatusCard } from "@/components/disputes/dispute-status-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const RETRYABLE_PAYMENT_STATUSES = new Set(["PENDING", "STK_SENT", "FAILED", "CANCELLED", "TIMEOUT"]);

const FAILURE_COPY: Record<string, { heading: string; body: string }> = {
  FAILED: { heading: "Payment failed", body: "Your M-PESA payment could not be completed." },
  CANCELLED: { heading: "Payment cancelled", body: "The M-PESA payment was cancelled." },
  TIMEOUT: { heading: "Payment timed out", body: "We did not receive payment confirmation from M-PESA." },
};

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

  const isBuyer = order.buyer_id === user.id;
  const farmerProfile = user.role === "farmer" ? await getOwnFarmerProfile() : null;
  const isFarmerOfOrder = farmerProfile
    ? order.items.some((item) => item.farmer_id === farmerProfile.id)
    : false;

  const [reviewedItemIds, dispute, payment] = await Promise.all([
    isBuyer && order.order_status === "COMPLETED" ? getReviewedOrderItemIds(order.id) : Promise.resolve(new Set<string>()),
    isBuyer || isFarmerOfOrder ? getDisputeForOrder(order.id) : Promise.resolve(null),
    // Only the actual mpesa_receipt_number/completed_at written by a real,
    // verified Daraja callback (confirm_mpesa_payment()) — never fabricated.
    order.payment_status === "PAID" ? getOrderPayment(order.id) : Promise.resolve(null),
  ]);

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

        {order.payment_status === "PAID" && (
          <div className="mt-6">
            <OrderReceipt order={order} payment={payment} />
          </div>
        )}

        {FAILURE_COPY[order.payment_status] && (
          <Card className="mt-6 border-destructive/30 bg-destructive/5">
            <CardContent className="flex gap-3 py-4">
              <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div className="text-sm">
                <p className="font-medium text-foreground">{FAILURE_COPY[order.payment_status].heading}</p>
                <p className="mt-1 text-muted-foreground">
                  {FAILURE_COPY[order.payment_status].body} Nothing was charged — you can try again
                  below.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {RETRYABLE_PAYMENT_STATUSES.has(order.payment_status) && (
          <div className="mt-6">
            <PayWithMpesa
              orderId={order.id}
              defaultPhone={order.buyer_phone}
              initialStatus={order.payment_status}
              mpesaConfigured={isMpesaConfigured()}
            />
          </div>
        )}

        {order.order_status === "DISPUTED" && (
          <Card className="mt-6 border-warning/30 bg-warning/5">
            <CardContent className="flex gap-3 py-4">
              <Info className="mt-0.5 size-5 shrink-0 text-warning" />
              <p className="text-sm text-foreground">
                Your payment went through, but we couldn&apos;t confirm enough stock for every
                item. Our team has been notified and will contact you to resolve this — you will
                not lose your payment.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Once PAID, the receipt above already shows items, totals, and
            delivery details together — showing them again here would just
            duplicate it in a plainer format. */}
        {order.payment_status !== "PAID" && (
          <>
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
          </>
        )}

        {isBuyer && order.order_status === "COMPLETED" && (
          <Card className="mt-6">
            <CardContent className="space-y-5 pt-6 pb-6">
              <p className="font-medium text-foreground">Rate your order</p>
              {order.items.map((item) =>
                reviewedItemIds.has(item.id) ? (
                  <p key={item.id} className="text-sm text-muted-foreground">
                    You already rated {item.product_name_snapshot}.
                  </p>
                ) : (
                  <ReviewForm key={item.id} orderItemId={item.id} productName={item.product_name_snapshot} />
                )
              )}
            </CardContent>
          </Card>
        )}

        {isBuyer && order.payment_status === "PAID" && (
          <div className="mt-6">
            {dispute ? <DisputeStatusCard dispute={dispute} /> : <DisputeForm orderId={order.id} />}
          </div>
        )}

        {!isBuyer && isFarmerOfOrder && dispute && (
          <div className="mt-6">
            <DisputeStatusCard dispute={dispute} />
          </div>
        )}

        <Button variant="outline" className="mt-6" asChild>
          <Link href="/marketplace">Continue shopping</Link>
        </Button>
      </main>
      <SiteFooter />
    </>
  );
}
