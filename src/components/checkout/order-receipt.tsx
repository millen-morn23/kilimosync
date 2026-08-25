"use client";

import { CheckCircle2, Download, Printer } from "lucide-react";

import type { OrderDetail } from "@/lib/data/orders";
import type { PaymentRow } from "@/lib/data/payments";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function money(value: number): string {
  return `KES ${value.toFixed(2)}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** A self-contained HTML file — no external stylesheet — so it renders
 * correctly on its own once downloaded and opened outside the app. */
function buildStandaloneReceiptHtml(order: OrderDetail, payment: PaymentRow | null): string {
  const rows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:6px 0;">${item.product_name_snapshot}</td>
        <td style="padding:6px 0;text-align:center;">${item.quantity}</td>
        <td style="padding:6px 0;text-align:right;">${money(item.price_at_purchase)}</td>
        <td style="padding:6px 0;text-align:right;">${money(item.subtotal)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>KilimoSync receipt — Order #${order.id.slice(0, 8)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1c1917; max-width: 640px; margin: 40px auto; padding: 0 20px; }
  h1 { color: #166534; font-size: 20px; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { text-align: left; border-bottom: 1px solid #e7e5e4; padding: 6px 0; font-size: 13px; color: #57534e; }
  th:nth-child(2) { text-align: center; }
  th:nth-child(3), th:nth-child(4) { text-align: right; }
  .total-row td { border-top: 1px solid #e7e5e4; padding-top: 10px; font-weight: 600; }
  .muted { color: #57534e; }
  .section { margin: 16px 0; }
  .badge { display: inline-block; background: #16a34a; color: #fff; padding: 2px 10px; border-radius: 999px; font-size: 13px; }
</style>
</head>
<body>
  <h1>KilimoSync</h1>
  <p class="muted">Order receipt</p>
  <p><span class="badge">Payment confirmed</span></p>

  <div class="section">
    <div><strong>Order:</strong> #${order.id.slice(0, 8)}</div>
    <div><strong>Order date:</strong> ${formatDateTime(order.created_at)}</div>
    ${payment?.mpesa_receipt_number ? `<div><strong>M-PESA receipt no:</strong> ${payment.mpesa_receipt_number}</div>` : ""}
    ${payment?.completed_at ? `<div><strong>Payment date/time:</strong> ${formatDateTime(payment.completed_at)}</div>` : ""}
  </div>

  <div class="section">
    <strong>Items</strong>
    <table>
      <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div class="section">
    <table>
      <tr><td class="muted">Subtotal</td><td style="text-align:right;">${money(order.subtotal)}</td></tr>
      <tr><td class="muted">Delivery fee</td><td style="text-align:right;">${money(order.delivery_fee)}</td></tr>
      <tr><td class="muted">Platform fee</td><td style="text-align:right;">${money(order.platform_fee)}</td></tr>
      <tr class="total-row"><td>Total amount paid</td><td style="text-align:right;">${money(order.total_amount)}</td></tr>
    </table>
  </div>

  <div class="section">
    <strong>Delivery details</strong>
    <div>${order.buyer_name} · ${order.buyer_phone}</div>
    <div>${order.delivery_address}, ${order.delivery_county}</div>
  </div>

  <p class="muted" style="margin-top:32px;font-size:12px;">Thank you for buying from KilimoSync — from Kenyan farms to your table.</p>
</body>
</html>`;
}

export function OrderReceipt({ order, payment }: { order: OrderDetail; payment: PaymentRow | null }) {
  function handlePrint() {
    window.print();
  }

  function handleDownload() {
    const html = buildStandaloneReceiptHtml(order, payment);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kilimosync-receipt-${order.id.slice(0, 8)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="receipt-print-area border-success/30">
      <CardContent className="space-y-6 pt-6 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="size-5" />
            <div>
              <p className="font-semibold text-foreground">Payment confirmed</p>
              <p className="text-sm text-muted-foreground">Your M-PESA payment was successful.</p>
            </div>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="size-4" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="size-4" />
              Download
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
            <Logo />
            <div className="text-right text-sm">
              <p className="font-medium text-foreground">Order #{order.id.slice(0, 8)}</p>
              <p className="text-muted-foreground">{formatDateTime(order.created_at)}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-1 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">M-PESA receipt no. </span>
              <span className="font-medium text-foreground">
                {payment?.mpesa_receipt_number ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Payment date/time. </span>
              <span className="font-medium text-foreground">
                {payment?.completed_at ? formatDateTime(payment.completed_at) : "—"}
              </span>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex flex-wrap justify-between gap-x-4 text-sm">
                <span className="text-muted-foreground">
                  {item.product_name_snapshot} × {item.quantity} @ {money(item.price_at_purchase)}
                </span>
                <span className="text-foreground">{money(item.subtotal)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">{money(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery fee</span>
              <span className="text-foreground">{money(order.delivery_fee)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform fee</span>
              <span className="text-foreground">{money(order.platform_fee)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
              <span className="text-foreground">Total amount paid</span>
              <span className="text-foreground">{money(order.total_amount)}</span>
            </div>
          </div>

          <div className="mt-6 space-y-1 border-t border-border pt-4 text-sm">
            <p className="font-medium text-foreground">Delivery details</p>
            <p className="text-muted-foreground">
              {order.buyer_name} · {order.buyer_phone}
            </p>
            <p className="text-muted-foreground">
              {order.delivery_address}, {order.delivery_county}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
