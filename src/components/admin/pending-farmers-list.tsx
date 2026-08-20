"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { rejectFarmer, verifyFarmer } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type PendingFarmer = {
  id: string;
  farm_name: string;
  county: string;
  main_crops: string[];
  created_at: string;
  users: { name: string; email: string } | null;
};

export function PendingFarmersList({ farmers }: { farmers: PendingFarmer[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handle(action: typeof verifyFarmer, farmerId: string) {
    setPendingId(farmerId);
    startTransition(async () => {
      const result = await action(farmerId);
      setPendingId(null);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Farmer status updated");
      router.refresh();
    });
  }

  if (farmers.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No farmers awaiting verification.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {farmers.map((farmer) => (
        <Card key={farmer.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div>
              <p className="font-medium text-foreground">{farmer.farm_name}</p>
              <p className="text-sm text-muted-foreground">
                {farmer.users?.name} · {farmer.users?.email} · {farmer.county}
              </p>
              {farmer.main_crops.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {farmer.main_crops.join(", ")}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isPending && pendingId === farmer.id}
                onClick={() => handle(rejectFarmer, farmer.id)}
              >
                Reject
              </Button>
              <Button
                size="sm"
                disabled={isPending && pendingId === farmer.id}
                onClick={() => handle(verifyFarmer, farmer.id)}
              >
                Verify
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
