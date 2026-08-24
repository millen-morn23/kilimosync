"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { resolveDispute } from "@/lib/actions/disputes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function DisputeResolveForm({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(status: "investigating" | "resolved" | "rejected") {
    setSubmitting(status);
    setError(null);
    const result = await resolveDispute(disputeId, status, response);
    setSubmitting(null);

    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const hasResponse = response.trim().length > 0;

  return (
    <div className="space-y-2">
      <Textarea
        rows={2}
        placeholder="Response to the buyer (required to resolve or reject)"
        value={response}
        onChange={(e) => setResponse(e.target.value)}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!!submitting} onClick={() => act("investigating")}>
          Investigating
        </Button>
        <Button size="sm" disabled={!!submitting || !hasResponse} onClick={() => act("resolved")}>
          Mark resolved
        </Button>
        <Button size="sm" variant="ghost" disabled={!!submitting || !hasResponse} onClick={() => act("rejected")}>
          Reject
        </Button>
      </div>
    </div>
  );
}
