"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createDeliveryPartnerProfileSchema,
  type CreateDeliveryPartnerProfileInput,
} from "@/lib/validation/delivery-partner";
import type { DeliveryAvailabilityStatus, OrderStatus } from "@/lib/supabase/types";

type ActionResult = { error: string } | { success: true };

/**
 * Creates the signed-in delivery partner's own profile. Only the fields a
 * partner actually fills in here are ever written — verification_status,
 * verified_at, verified_by, and availability_status are never touched by
 * this action, and even if a caller tried to smuggle them into the input,
 * they're not part of CreateDeliveryPartnerProfileInput at all, so there's
 * nothing to strip. The database is the real backstop regardless: RLS
 * scopes the insert to the caller's own user_id and current_role() =
 * 'delivery_partner' (0017_delivery_partner_profiles.sql), and the
 * verification guard trigger would reject any attempt to set those
 * protected columns even if this action tried to.
 */
export async function createDeliveryPartnerProfile(
  input: CreateDeliveryPartnerProfileInput
): Promise<ActionResult> {
  const parsed = createDeliveryPartnerProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const { vehicleType, vehicleRegistration, operatingCounty } = parsed.data;

  const { error } = await supabase.from("delivery_partner_profiles").insert({
    user_id: user.id,
    vehicle_type: vehicleType,
    vehicle_registration: vehicleRegistration || null,
    operating_county: operatingCounty,
  });

  if (error) {
    // Unique constraint on user_id means a profile already exists.
    if (error.code === "23505") {
      return { error: "You already have a delivery partner profile." };
    }
    return { error: "Could not create your delivery partner profile. Please try again." };
  }

  revalidatePath("/dashboard/delivery-partner");
  return { success: true };
}

/**
 * RLS (delivery_partner_profiles_update_own_or_admin, 0017) already scopes
 * this update to the caller's own row, and guard_delivery_partner_verification_update()
 * blocks changes to verification_status/verified_at/verified_by for
 * non-admins regardless of what's sent — this whitelist just doesn't
 * attempt to touch those columns in the first place. availability_status
 * is likewise not part of this form; it isn't exposed yet (Phase B has no
 * job-matching consumer for it — see the design document's B4 scope note).
 */
export async function updateDeliveryPartnerProfile(
  input: CreateDeliveryPartnerProfileInput
): Promise<ActionResult> {
  const parsed = createDeliveryPartnerProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const { vehicleType, vehicleRegistration, operatingCounty } = parsed.data;

  const { error } = await supabase
    .from("delivery_partner_profiles")
    .update({
      vehicle_type: vehicleType,
      vehicle_registration: vehicleRegistration || null,
      operating_county: operatingCounty,
    })
    .eq("user_id", user.id);

  if (error) {
    return { error: "Could not update your delivery partner profile. Please try again." };
  }

  revalidatePath("/dashboard/delivery-partner");
  return { success: true };
}

const AVAILABILITY_STATUSES = new Set<DeliveryAvailabilityStatus>(["AVAILABLE", "UNAVAILABLE"]);

/**
 * Self-service availability toggle (Phase C, checkpoint C1). This is the
 * first real consumer of delivery_partner_profiles.availability_status —
 * nothing in Phase B needed it. Both database-level guards it depends on
 * already exist and are untouched by this action:
 *
 *   - delivery_partner_profiles_availability_requires_verified (a plain
 *     CHECK constraint, 0017): rejects AVAILABLE for anyone whose
 *     verification_status isn't 'verified' — unconditionally, regardless
 *     of what this action or the client attempts.
 *   - guard_delivery_partner_availability_update() (0017): rejects
 *     AVAILABLE for a suspended user (users.is_suspended), same way.
 *
 * This action does not special-case either check — it just issues the
 * update through the RLS-respecting client and surfaces a friendly error
 * if the database rejects it. The runtime check against
 * AVAILABILITY_STATUSES exists because this is called with a value that
 * ultimately comes from a client component; the real boundary is the
 * database, not this check (see CLAUDE.md rule 3).
 */
export async function setDeliveryPartnerAvailability(
  status: DeliveryAvailabilityStatus
): Promise<ActionResult> {
  if (!AVAILABILITY_STATUSES.has(status)) {
    return { error: "Invalid availability status." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const { error } = await supabase
    .from("delivery_partner_profiles")
    .update({ availability_status: status })
    .eq("user_id", user.id);

  if (error) {
    if (error.code === "23514") {
      return { error: "You must be verified before you can go available." };
    }
    return { error: "Could not update your availability. Please try again." };
  }

  revalidatePath("/dashboard/delivery-partner");
  return { success: true };
}

/**
 * Claims an UNASSIGNED delivery (Phase C, checkpoint C4). Deliberately a
 * single atomic conditional UPDATE, issued through the caller's own
 * RLS-respecting session — never the service-role client, and never a
 * SECURITY DEFINER RPC — per the approved Phase C design's §3: atomicity
 * here comes from the WHERE clause plus Postgres row-locking, not from
 * which client issues it, the same shape record_stk_initiation() and
 * deduct_product_inventory() already rely on for their own concurrent-
 * write races.
 *
 * transporter_id is always auth.uid(), never a client-supplied value —
 * there is no input parameter for it at all. Eligibility (verified,
 * available, not suspended, county match) and the claim's legality are
 * re-checked independently by deliveries_claim_and_advance_by_partner
 * (RLS) and guard_delivery_status_update() (0018_delivery_assignment.sql)
 * — this action does not duplicate either check. If the row was already
 * claimed, or the caller isn't eligible in the first place, the WHERE
 * clause / RLS simply matches zero rows; both cases are indistinguishable
 * here by design (§3: "reports 'already claimed' rather than trusting any
 * client-side state") and are reported with the same generic message.
 *
 * Audit logging (Phase C, checkpoint C7): §14 of the approved design names
 * "claimed — which partner claimed which delivery, when" as one of the
 * three events Phase C's audit trail must cover. Written only after the
 * claim UPDATE above has already succeeded, via the service-role client —
 * audit_logs has no client-side insert policy for any role — the same
 * authorize-via-RLS-then-escalate-only-for-the-write-RLS-forbids pattern
 * markDeliveryFailed() and admin.ts already use.
 */
export async function claimDelivery(deliveryId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data, error } = await supabase
    .from("deliveries")
    .update({
      transporter_id: user.id,
      status: "ASSIGNED",
      assigned_at: new Date().toISOString(),
    })
    .eq("id", deliveryId)
    .eq("status", "UNASSIGNED")
    .is("transporter_id", null)
    .select("id, order_id")
    .maybeSingle();

  if (error) {
    return { error: "Could not claim this delivery. Please try again." };
  }

  if (!data) {
    return { error: "This delivery has already been claimed." };
  }

  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "delivery_claimed",
    entity_type: "deliveries",
    entity_id: deliveryId,
    metadata: { order_id: data.order_id },
  });

  revalidatePath("/dashboard/delivery-partner");
  return { success: true };
}

type AdvanceableDeliveryStatus = "PICKED_UP" | "IN_TRANSIT" | "DELIVERED";

// The one legal predecessor for each requested status — the same forward
// chain guard_delivery_status_update() (0018) already enforces as the
// final authority. Included in this action's own WHERE clause purely for
// the atomic-conditional-UPDATE race protection (§3 of the Phase C
// design), not as a second, independent authorization system: an
// ineligible or wrong-predecessor request simply matches zero rows here,
// and would also have been rejected by the trigger had it somehow reached
// it.
const ADVANCE_FROM_STATUS: Record<AdvanceableDeliveryStatus, "ASSIGNED" | "PICKED_UP" | "IN_TRANSIT"> = {
  PICKED_UP: "ASSIGNED",
  IN_TRANSIT: "PICKED_UP",
  DELIVERED: "IN_TRANSIT",
};

// The exact delivery_status -> order_status mapping from the approved
// Phase C design (§5, §9): "picked up" and "on the way" are one buyer-
// facing bucket (OUT_FOR_DELIVERY) since order_status has no separate
// in-transit value, so only PICKED_UP and DELIVERED are sync points —
// IN_TRANSIT intentionally has no entry here and triggers no orders
// write. Two sync points total, matching the design's own C5 test
// description ("confirms order_status advances correctly at both sync
// points").
const ORDER_STATUS_SYNC: Partial<Record<AdvanceableDeliveryStatus, OrderStatus>> = {
  PICKED_UP: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
};

/**
 * Advances an assigned partner's delivery one step (Phase C, checkpoint
 * C5). The delivery write goes through the caller's own RLS-respecting
 * session — transporter_id is always auth.uid(), never a client-supplied
 * value, and is part of the WHERE clause (not just a payload field), so
 * an unrelated partner's delivery simply doesn't match and is untouched.
 * guard_delivery_status_update() (0018) remains the final authority on
 * transition legality; the ADVANCE_FROM_STATUS check here exists only for
 * atomicity, the same reasoning claimDelivery() already documents.
 *
 * The orders.order_status sync happens only after the delivery UPDATE
 * above has already succeeded, and only through the service-role client —
 * never a database trigger. This is the exact architecture the Phase C
 * design's §12 risk callout requires: a trigger-driven sync would re-fire
 * guard_order_status_update() under the *original* caller's auth.role()
 * (a delivery partner's session, not service_role), which would reject it
 * — the same auth.role()/SECURITY DEFINER failure class already fixed
 * once for M-PESA in 0013/0014. Routing this through
 * src/lib/actions/delivery-partner.ts's own service-role call, after
 * authorization is already established, reuses that same already-proven
 * auth.role() = 'service_role' bypass instead.
 */
export async function advanceDeliveryStatus(
  deliveryId: string,
  nextStatus: AdvanceableDeliveryStatus
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const patch =
    nextStatus === "PICKED_UP"
      ? { status: "PICKED_UP" as const, picked_up_at: new Date().toISOString() }
      : nextStatus === "DELIVERED"
        ? { status: "DELIVERED" as const, delivered_at: new Date().toISOString() }
        : { status: "IN_TRANSIT" as const };

  const { data: delivery, error } = await supabase
    .from("deliveries")
    .update(patch)
    .eq("id", deliveryId)
    .eq("transporter_id", user.id)
    .eq("status", ADVANCE_FROM_STATUS[nextStatus])
    .select("order_id")
    .maybeSingle();

  if (error) {
    return { error: "Could not update this delivery. Please try again." };
  }

  if (!delivery) {
    return { error: "This delivery isn't in a state that allows that update." };
  }

  const syncedOrderStatus = ORDER_STATUS_SYNC[nextStatus];
  if (syncedOrderStatus) {
    const admin = createAdminClient();
    await admin.from("orders").update({ order_status: syncedOrderStatus }).eq("id", delivery.order_id);
  }

  revalidatePath("/dashboard/delivery-partner");
  revalidatePath(`/orders/${delivery.order_id}`);
  return { success: true };
}

/**
 * Self-service release of a claimed-but-not-yet-picked-up delivery (Phase
 * C, checkpoint C5), matching the Phase C design's §6/§17 transition
 * exactly: ASSIGNED -> UNASSIGNED, only before pickup, only by the
 * currently assigned partner. guard_delivery_status_update() (0018) is
 * the actual authority — its release clause only accepts
 * `old.status = 'ASSIGNED' and new.status = 'UNASSIGNED' and
 * new.transporter_id is null`, which is exactly what this UPDATE sends;
 * anything already past ASSIGNED (PICKED_UP/IN_TRANSIT) falls through to
 * the trigger's transition whitelist and is rejected, matching the
 * design's explicit "no release after pickup" rule.
 *
 * FLAGGED (see the C5 report): tracing 0018's RLS on this exact write
 * turned up what reads as a pre-existing bug in that already-committed
 * migration, not something introduced here.
 * deliveries_claim_and_advance_by_partner's WITH CHECK is unconditionally
 * `transporter_id = auth.uid()`. Postgres evaluates WITH CHECK against
 * the final new row *after* BEFORE-row triggers run, and this trigger
 * doesn't rewrite transporter_id for the release case — it stays NULL, as
 * this UPDATE sends it. `NULL = auth.uid()` is NULL, not TRUE, so RLS
 * itself appears to reject this write with "new row violates row-level
 * security policy," independently of the trigger already permitting the
 * transition. This is reasoned from the literal policy/trigger text, not
 * verified against a live project (none is connected in this
 * environment). The application code below is the correct shape per the
 * design regardless; the fix, if this holds, is a migration correcting
 * 0018's WITH CHECK — out of scope to create without your approval.
 *
 * Only transporter_id and status are touched — assigned_at is
 * deliberately left as-is. Neither 0018's guard trigger nor the Phase C
 * design requires clearing it on release, and inventing a new field-clear
 * behavior beyond what's specified isn't this checkpoint's call to make.
 *
 * No orders.order_status change: the order never advanced past
 * READY_FOR_DELIVERY while a delivery sits ASSIGNED (the sync only starts
 * at PICKED_UP, see advanceDeliveryStatus() above), so there is nothing to
 * revert.
 */
export async function releaseClaim(deliveryId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data, error } = await supabase
    .from("deliveries")
    .update({ transporter_id: null, status: "UNASSIGNED" })
    .eq("id", deliveryId)
    .eq("transporter_id", user.id)
    .eq("status", "ASSIGNED")
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "Could not release this delivery. Please try again." };
  }

  if (!data) {
    return { error: "This delivery can no longer be released." };
  }

  revalidatePath("/dashboard/delivery-partner");
  return { success: true };
}

/**
 * Marks an assigned delivery as failed (Phase C, checkpoint C5), following
 * §17 of the approved design exactly: deliveries.status = 'FAILED' through
 * the authenticated partner's own session (transporter_id = auth.uid() in
 * the WHERE clause proves — via the database, not an app-level role check
 * — that the caller is actually assigned to this delivery; an unrelated
 * partner's attempt matches zero rows and is rejected the same way an
 * already-claimed job is), then, only once that succeeds, two service-role
 * writes: orders.order_status -> 'DISPUTED' (reusing the exact semantics
 * confirm_mpesa_payment()'s oversold-inventory case already established —
 * notify_order_status_change() already fires the existing buyer
 * notification for DISPUTED, unchanged, no new notification type needed),
 * and a real disputes row (reason 'delivery_failed', authored by the
 * order's buyer, since disputes.user_id is not-null) — the same
 * real-dispute-not-just-a-flag pattern, reusing the existing disputes
 * table and RLS rather than a second dispute mechanism. The insert
 * tolerates disputes_one_active_per_order (0012): if this order already
 * has an open/investigating dispute, the unique-violation is expected and
 * non-fatal, the same way confirm_mpesa_payment()'s equivalent insert
 * tolerates it with its own ON CONFLICT clause.
 *
 * See this file's implementation notes (surfaced in the C5 report) for the
 * one known gap: these three writes are three separate round trips, not
 * one atomic transaction the way confirm_mpesa_payment() is as a single
 * Postgres function — a failure between steps is a real, currently
 * unhandled possibility, not something the approved design specifies a
 * fix for.
 */
export async function markDeliveryFailed(deliveryId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: delivery, error } = await supabase
    .from("deliveries")
    .update({ status: "FAILED" })
    .eq("id", deliveryId)
    .eq("transporter_id", user.id)
    .in("status", ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"])
    .select("order_id")
    .maybeSingle();

  if (error) {
    return { error: "Could not mark this delivery as failed. Please try again." };
  }

  if (!delivery) {
    return { error: "This delivery can't be marked failed right now." };
  }

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .update({ order_status: "DISPUTED" })
    .eq("id", delivery.order_id)
    .select("buyer_id")
    .maybeSingle();

  if (order) {
    await admin.from("disputes").insert({
      order_id: delivery.order_id,
      user_id: order.buyer_id,
      reason: "delivery_failed",
      description:
        "Automatically flagged by KilimoSync: the delivery partner marked this delivery as failed.",
    });
  }

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "delivery_marked_failed",
    entity_type: "deliveries",
    entity_id: deliveryId,
    metadata: { order_id: delivery.order_id },
  });

  revalidatePath("/dashboard/delivery-partner");
  revalidatePath(`/orders/${delivery.order_id}`);
  return { success: true };
}
