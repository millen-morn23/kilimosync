"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { claimDelivery } from "@/lib/actions/delivery-partner";
import type { AvailableDeliveryJob } from "@/lib/data/current-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AvailableJobsList({ jobs }: { jobs: AvailableDeliveryJob[] }) {
  const router = useRouter();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClaim(jobId: string) {
    setClaimingId(jobId);
    startTransition(async () => {
      const result = await claimDelivery(jobId);
      setClaimingId(null);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Delivery claimed.");
      router.refresh();
    });
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No delivery jobs available in your area right now. Check back soon.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <Card key={job.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div>
              <p className="font-medium text-foreground">{job.pickup_location}</p>
              <p className="text-sm text-muted-foreground">
                Delivery fee: KES {job.delivery_fee.toFixed(2)}
              </p>
            </div>
            <Button
              size="sm"
              disabled={isPending && claimingId === job.id}
              onClick={() => handleClaim(job.id)}
            >
              Claim
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
