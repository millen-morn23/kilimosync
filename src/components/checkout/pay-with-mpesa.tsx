"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Smartphone } from "lucide-react";

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
}: {
  orderId: string;
  defaultPhone: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(defaultPhone);
  const [phase, setPhase] = useState<Phase>(initialStatus === "STK_SENT" ? "waiting" : "form");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollStart = useRef<number>(0);

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
    setError(null);
    setSubmitting(true);
    const result = await initiatePayment(orderId, phone);
    setSubmitting(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }
    setPhase("waiting");
  }

  if (phase === "waiting") {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="font-medium text-foreground">Check your phone</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Enter your M-PESA PIN on the prompt sent to {phone} to complete this payment.
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

        {phase === "timed_out" && (
          <p className="text-sm text-warning">
            We didn&apos;t hear back in time. If you already entered your PIN, this page will
            update shortly — otherwise, try again.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="mpesa-phone">M-PESA phone number</Label>
            <Input
              id="mpesa-phone"
              type="tel"
              placeholder="0712 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Sending prompt…" : "Pay now"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
