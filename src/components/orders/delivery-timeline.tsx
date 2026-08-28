import { cn } from "@/lib/utils";
import type { OrderDeliveryInfo } from "@/lib/data/orders";

type StageKey = "ASSIGNED" | "PICKED_UP" | "IN_TRANSIT" | "DELIVERED";

const STAGE_DEFS: { key: StageKey; label: string }[] = [
  { key: "ASSIGNED", label: "Assigned" },
  { key: "PICKED_UP", label: "Picked up" },
  { key: "IN_TRANSIT", label: "In transit" },
  { key: "DELIVERED", label: "Delivered" },
];

type StageState = "completed" | "current" | "pending" | "failed";

type TimelineStage = {
  key: string;
  label: string;
  timestamp: string | null;
  state: StageState;
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Phase E, checkpoint E-3. Renders deliveries.status + the five stage
 * timestamps (0020_delivery_tracking_timestamps.sql) as a chronological
 * timeline — completed / current / pending, per stage, using only the
 * real stored values (never a fabricated or estimated one).
 *
 * FAILED is a terminal branch, not a fifth pending slot: only the stages
 * actually reached (non-null timestamp) render, followed by one Failed
 * entry using failed_at. Whatever forward stages were never reached are
 * omitted entirely, not shown as "pending" — DELIVERED is never implied
 * to still be coming after a failure.
 *
 * Caller is responsible for only rendering this once a partner is
 * actually assigned (delivery.assignedPartner truthy) — this component
 * has no UNASSIGNED case of its own, matching the existing buyer/farmer
 * asymmetry already established in Phase C.
 */
export function DeliveryTimeline({ delivery }: { delivery: OrderDeliveryInfo }) {
  const timestampByStage: Record<StageKey, string | null> = {
    ASSIGNED: delivery.assignedAt,
    PICKED_UP: delivery.pickedUpAt,
    IN_TRANSIT: delivery.inTransitAt,
    DELIVERED: delivery.deliveredAt,
  };
  const isFailed = delivery.status === "FAILED";

  const stages: TimelineStage[] = STAGE_DEFS.filter(
    (stage) => !isFailed || timestampByStage[stage.key] !== null
  ).map((stage) => {
    const timestamp = timestampByStage[stage.key];
    const state: StageState =
      stage.key === delivery.status ? "current" : timestamp !== null ? "completed" : "pending";
    return { key: stage.key, label: stage.label, timestamp, state };
  });

  if (isFailed) {
    stages.push({ key: "FAILED", label: "Failed", timestamp: delivery.failedAt, state: "failed" });
  }

  return (
    <ol className="space-y-1.5">
      {stages.map((stage) => (
        <li key={stage.key} className="flex items-center gap-2.5 text-sm">
          <span
            aria-hidden="true"
            className={cn(
              "size-2 shrink-0 rounded-full",
              stage.state === "completed" && "bg-primary",
              stage.state === "current" && "bg-primary ring-4 ring-primary/20",
              stage.state === "pending" && "bg-muted-foreground/25",
              stage.state === "failed" && "bg-destructive"
            )}
          />
          <span
            className={cn(
              stage.state === "pending" ? "text-muted-foreground" : "text-foreground",
              (stage.state === "current" || stage.state === "failed") && "font-medium",
              stage.state === "failed" && "text-destructive"
            )}
          >
            {stage.label}
          </span>
          {stage.timestamp && (
            <span className="ml-auto text-xs text-muted-foreground">
              {formatTimestamp(stage.timestamp)}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
