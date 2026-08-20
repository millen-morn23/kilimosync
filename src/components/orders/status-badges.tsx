import { Badge } from "@/components/ui/badge";

const ORDER_STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "outline"> = {
  PENDING_PAYMENT: "warning",
  CONFIRMED: "success",
  PREPARING: "default",
  READY_FOR_DELIVERY: "default",
  OUT_FOR_DELIVERY: "default",
  DELIVERED: "success",
  COMPLETED: "success",
  CANCELLED: "destructive",
  REFUNDED: "outline",
  DISPUTED: "destructive",
};

const PAYMENT_STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "outline"> = {
  PENDING: "warning",
  STK_SENT: "warning",
  PROCESSING: "warning",
  PAID: "success",
  FAILED: "destructive",
  CANCELLED: "destructive",
  TIMEOUT: "destructive",
};

function humanize(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function OrderStatusBadge({ status }: { status: string }) {
  return <Badge variant={ORDER_STATUS_VARIANT[status] ?? "outline"}>{humanize(status)}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return <Badge variant={PAYMENT_STATUS_VARIANT[status] ?? "outline"}>{humanize(status)}</Badge>;
}
