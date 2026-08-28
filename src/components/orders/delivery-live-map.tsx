"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

import { createClient } from "@/lib/supabase/client";
import type { DeliveryLocationSnapshot } from "@/lib/data/orders";

// ssr:false is required, not optional — Leaflet touches `window` at module
// load and would break Next.js's server render pass for this "use client"
// component otherwise. See delivery-position-map.tsx's own doc comment.
const DeliveryPositionMap = dynamic(() => import("./delivery-position-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[220px] w-full items-center justify-center rounded-lg border border-border bg-muted text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

const STALE_THRESHOLD_MS = 2 * 60 * 1000;
// Re-evaluates staleness periodically even with no new Realtime event —
// deliberately far below any high-frequency polling: this never queries
// anything, it only re-renders against the clock so a position that's
// gone quiet is eventually shown as stale rather than staying "live"
// forever just because no new row arrived.
const STALE_CHECK_INTERVAL_MS = 30_000;

type Phase = "waiting" | "tracking" | "ended";

type DeliveryLocationRow = {
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  recorded_at: string;
};

/**
 * Phase F, checkpoint F-3. Buyer/farmer live map — subscribes to exactly
 * one delivery's row in delivery_locations via Supabase Realtime (Postgres
 * Changes), filtered server-side to `delivery_id=eq.${deliveryId}`. The
 * filter is a convenience/efficiency narrowing, not the authorization
 * boundary: RLS (delivery_locations_select_participants_or_admin, 0021)
 * is what actually determines whether any event ever reaches this
 * subscriber, exactly as it already does for a plain SELECT — a client
 * subscribing to a delivery_id it isn't authorized for simply never
 * receives anything, filter or not.
 *
 * `deliveryId` and `initialLocation` both come from data the caller
 * already fetched server-side, through the same RLS-respecting session as
 * everything else on the page (getDeliveryInfoForOrders(),
 * src/lib/data/orders.ts) — this component never accepts or infers
 * ownership of a delivery on its own; it only renders what it was already
 * authorized to receive from the page that mounted it.
 *
 * Three explicit phases, not just "do we have a location":
 *   - waiting: no location has ever arrived (matches "never fabricate a
 *     position" — nothing is shown until something real exists).
 *   - tracking: a real position exists, live or stale (§ below).
 *   - ended: a Realtime DELETE event arrived — the delivery went
 *     terminal/released and 0021's cleanup trigger removed the row. This
 *     is distinct from "waiting" on purpose: it's a definite "tracking
 *     has stopped" fact, not merely "nothing yet." If the same delivery
 *     is later reclaimed by a new partner, a fresh INSERT naturally moves
 *     the phase back to "tracking" — no special-casing needed.
 */
export function DeliveryLiveMap({
  deliveryId,
  initialLocation,
}: {
  deliveryId: string;
  initialLocation: DeliveryLocationSnapshot | null;
}) {
  const [location, setLocation] = useState<DeliveryLocationSnapshot | null>(initialLocation);
  const [phase, setPhase] = useState<Phase>(initialLocation ? "tracking" : "waiting");
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), STALE_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`delivery-location-${deliveryId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_locations",
          filter: `delivery_id=eq.${deliveryId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setLocation(null);
            setPhase("ended");
            return;
          }
          const row = payload.new as DeliveryLocationRow;
          setLocation({
            latitude: row.latitude,
            longitude: row.longitude,
            accuracyMeters: row.accuracy_meters,
            recordedAt: row.recorded_at,
          });
          setPhase("tracking");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deliveryId]);

  if (phase === "waiting") {
    return (
      <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
        Waiting for the delivery partner&apos;s location…
      </p>
    );
  }

  if (phase === "ended" || !location) {
    return (
      <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
        Delivery tracking has ended.
      </p>
    );
  }

  const isStale = nowTick - new Date(location.recordedAt).getTime() > STALE_THRESHOLD_MS;

  return (
    <div className="space-y-2">
      <DeliveryPositionMap
        latitude={location.latitude}
        longitude={location.longitude}
        accuracyMeters={location.accuracyMeters}
      />
      <p className={isStale ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>
        {isStale ? "Location may not be current." : "Live location."}
      </p>
    </div>
  );
}
