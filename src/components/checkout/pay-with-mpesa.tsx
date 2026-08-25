"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Smartphone, TriangleAlert } from "lucide-react";

import { getOrderPaymentStatus, initiatePayment } from "@/lib/actions/mpesa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90_000;
const TERMINAL_STATUSES = new Set(["PAID", "FAILED", "CANCELLED", "TIMEOUT"]);

type Phase = "form" | "waiting" | "timed_out";

export function PayWithMpesa({
  orderId,
  defaultPhone,
  initialStatus,
  mpesaConfigured,
}: {
  orderId: string;
  defaultPhone: string;
  initialStatus: string;
  mpesaConfigured: boolean;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(defaultPhone);
  const [phase, setPhase] = useState<Phase>(initialStatus === "STK_SENT" ? "waiting" : "form");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollStart = useRef<number>(0);
  // A synchronous guard in addition to the disabled-button state: state
  // updates only take effect on the next render, so a fast double-click
  // (or double-tap on mobile) could otherwise slip a second submission
  // through before the button visually disables.
  const submittingRef = useRef(false);

  useEffect(() => {
    if (phase !== "waiting") return;
    pollStart.current = Date.now();

    const interval = setInterval(async () => {
      const status = await getOrderPaymentStatus(orderId);
      if (!status) return;

      if (TERMINAL_STATUSES.has(status.paymentStatus)) {
        clearInterval(interval);
        router.refresh();
        return;
      }

      if (Date.now() - pollStart.current > POLL_TIMEOUT_MS) {
        clearInterval(interval);
        setPhase("timed_out");
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [phase, orderId, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setSubmitting(true);

    const result = await initiatePayment(orderId, phone);

    submittingRef.current = false;
    setSubmitting(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }
    // Daraja accepted the STK push — this is NOT payment confirmation,
    // only that the PIN prompt was sent. The database payment_status
    // (polled below) is the only source of truth for what happens next.
    setPhase("waiting");
  }

  if (phase === "waiting" || phase === "timed_out") {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          {phase === "waiting" ? (
            <Loader2 className="size-8 animate-spin text-primary" />
          ) : (
            <TriangleAlert className="size-8 text-warning" />
          )}
          <p className="font-medium text-foreground">M-PESA prompt sent</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Check your phone and enter your M-PESA PIN to complete the payment.
          </p>
          {phase === "waiting" ? (
            <p className="text-sm font-medium text-primary">Waiting for payment confirmation…</p>
          ) : (
            <p className="max-w-xs text-sm text-warning">
              We didn&apos;t hear back in time. If you already entered your PIN, this page will
              update shortly on its own — otherwise nothing was charged and you can try again.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!mpesaConfigured) {
    return (
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="flex gap-3 py-4">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          <p className="text-sm text-foreground">
            M-PESA payments are not configured in this environment yet. You won&apos;t be able to
            pay for this order until they are — nothing has been charged.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6 pb-6">
        <div className="flex items-center gap-2 text-foreground">
          <Smartphone className="size-5 text-primary" />
          <p className="font-medium">Pay with M-PESA</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="mpesa-phone">M-PESA phone number</Label>
            <Input
              id="mpesa-phone"
              type="tel"
              placeholder="0712 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Processing payment…
              </span>
            ) : (
              "Pay now"
            )}
          </Button>
          {submitting && (
            <p className="text-center text-xs text-muted-foreground">
              Sending an M-PESA prompt to your phone…
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
