"use client";

import { useEffect, useRef, useState } from "react";

import { updateDeliveryPartnerLocation } from "@/lib/actions/delivery-partner";
import { Badge } from "@/components/ui/badge";

// Requested cadence, not a guarantee — the browser/OS decide how often
// watchPosition() actually calls back; this only throttles how often we
// write when it calls back more frequently than this.
const TARGET_UPDATE_INTERVAL_MS = 15_000;

type SharingState = "starting" | "active" | "denied" | "unavailable";

/**
 * Phase F, checkpoint F-2. Renders alongside (not inside) ActiveDeliveryCard
 * on the delivery-partner dashboard — takes only the id of the delivery
 * already fetched there (getActiveDelivery(), Phase C checkpoint C6), no
 * second query. Mount/unmount, driven entirely by the parent page's own
 * `activeDelivery && (...)` conditional, is what starts and stops tracking:
 * every existing status-changing action in ActiveDeliveryCard already calls
 * router.refresh() on success, which re-fetches activeDelivery server-side
 * and either keeps this component mounted with a fresh delivery.id (still
 * ASSIGNED/PICKED_UP/IN_TRANSIT — tracking continues uninterrupted) or
 * removes it entirely (DELIVERED/FAILED/released — activeDelivery becomes
 * null), firing this effect's cleanup and calling clearWatch(). No status
 * value is read in this component at all — mount state alone is the stop
 * condition, so ActiveDeliveryCard itself needs no changes.
 *
 * Defense in depth if a stale tab somehow keeps calling back after the
 * delivery has actually gone terminal elsewhere (e.g. an admin override in
 * another session): the write action re-checks status server-side on every
 * call, and 0021's cleanup trigger has already deleted the row the moment
 * that happened — a write from a stale tab is rejected, never persisted.
 * The client-side stop above is a UX nicety; the real boundary is the
 * database, same as everywhere else in this codebase.
 */
export function LocationSharingIndicator({ deliveryId }: { deliveryId: string }) {
  // Lazy initializer, not an effect: this runs during render (including
  // Next.js's server render pass for the initial HTML, where `navigator`
  // doesn't exist — guarded below), so it never needs a synchronous
  // setState() inside the effect body just to report "unsupported."
  const [state, setState] = useState<SharingState>(() =>
    typeof navigator !== "undefined" && "geolocation" in navigator ? "starting" : "unavailable"
  );
  const lastSentAtRef = useRef(0);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    lastSentAtRef.current = 0;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastSentAtRef.current < TARGET_UPDATE_INTERVAL_MS) return;
        lastSentAtRef.current = now;

        setState("active");
        void updateDeliveryPartnerLocation({
          deliveryId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          recordedAt: new Date(position.timestamp).toISOString(),
        });
      },
      (error) => {
        // PERMISSION_DENIED is distinct from POSITION_UNAVAILABLE/TIMEOUT —
        // the former means sharing is genuinely off until the partner
        // changes a browser setting; the latter just means no fix yet,
        // and watchPosition() keeps trying on its own. No programmatic
        // re-prompt in either case.
        setState(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: false }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [deliveryId]);

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
      <p className="text-muted-foreground">
        Location sharing starts when you begin an active delivery and stops when the delivery
        ends. Your browser will separately ask for location permission.
      </p>
      <div className="mt-2">
        {state === "active" && <Badge variant="success">Location sharing: active</Badge>}
        {state === "starting" && <Badge variant="outline">Starting location sharing…</Badge>}
        {state === "denied" && (
          <Badge variant="destructive">
            Location sharing is off — enable location permission for this site in your browser
          </Badge>
        )}
        {state === "unavailable" && (
          <Badge variant="outline">Waiting for a location signal…</Badge>
        )}
      </div>
    </div>
  );
}
