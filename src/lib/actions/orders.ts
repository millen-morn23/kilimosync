"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderStatus } from "@/lib/supabase/types";

type ActionResult = { error: string } | { success: true };

const FARMER_ALLOWED = new Set(["PREPARING", "READY_FOR_DELIVERY"]);
const ADMIN_ALLOWED = new Set(["OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED", "CANCELLED"]);

/**
 * Advances an order's status. The actual authorization and legal-transition
 * rules are enforced in Postgres (orders_update_farmer_of_order RLS policy
 * + guard_order_status_update trigger, supabase/migrations/0008_orders_lifecycle.sql)
 * — the checks here just produce a friendlier error than a raw Postgres
 * exception, and keep a farmer from even attempting an admin-only status.
 *
 * Phase D, checkpoint D1: for the admin's ordinary OUT_FOR_DELIVERY/DELIVERED
 * transitions, syncDeliveryIfUnclaimed() runs BEFORE order_status is written
 * and must succeed — if a delivery partner has already claimed the
 * delivery, the whole transition is rejected here, not just the delivery
 * side of it, so order_status never advances ahead of a delivery a partner
 * is actively working. COMPLETED and CANCELLED never touched deliveries and
 * are untouched by this checkpoint (D2/D3 are separate, later checkpoints).
 */
export async function updateOrderStatus(orderId: string, status: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  const role = profile?.role;

  if (role === "farmer") {
    if (!FARMER_ALLOWED.has(status)) return { error: "That status isn't available to farmers." };
  } else if (role === "admin") {
    if (!ADMIN_ALLOWED.has(status)) return { error: "That status isn't available here." };
  } else {
    return { error: "Not authorized to update orders." };
  }

  if (role === "admin" && (status === "OUT_FOR_DELIVERY" || status === "DELIVERED")) {
    const syncResult = await syncDeliveryIfUnclaimed(supabase, orderId, status);
    if ("error" in syncResult) {
      return syncResult;
    }
  }

  const { error } = await supabase
    .from("orders")
    .update({ order_status: status as OrderStatus })
    .eq("id", orderId);

  if (error) {
    return { error: "Could not update this order — it may have already moved on." };
  }

  if (role === "farmer" && status === "READY_FOR_DELIVERY") {
    await createDeliveryJob(supabase, orderId);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/dashboard/farmer/orders");
  revalidatePath("/admin/orders");
  return { success: true };
}

/**
 * Phase D, checkpoint D1. Performs the same delivery-side sync the admin's
 * ordinary OUT_FOR_DELIVERY/DELIVERED buttons have always driven — but only
 * when the delivery is provably not claimed by a partner. "Provably" means
 * an atomic conditional UPDATE (.is("transporter_id", null)) exactly like
 * claimDelivery()/advanceDeliveryStatus() (src/lib/actions/delivery-partner.ts)
 * already use for their own concurrent-write races — never a SELECT-then-
 * branch that could go stale between the read and the write.
 *
 * If that atomic UPDATE matches zero rows, a follow-up SELECT distinguishes
 * two cases: no delivery exists yet (the legacy admin-fallback insert this
 * function has always done, preserved byte-for-byte — createDeliveryJob()
 * is the only other writer of a fresh row, and it's always UNASSIGNED with
 * a null transporter_id, never a claim, so this branch can't collide with a
 * partner claiming) versus a delivery that IS claimed (transporter_id set),
 * which is rejected outright — the caller (updateOrderStatus) must not then
 * write order_status either.
 */
async function syncDeliveryIfUnclaimed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  orderStatus: "OUT_FOR_DELIVERY" | "DELIVERED"
): Promise<ActionResult> {
  const now = new Date().toISOString();
  const patch =
    orderStatus === "OUT_FOR_DELIVERY"
      ? { status: "IN_TRANSIT" as const, assigned_at: now, picked_up_at: now }
      : { status: "DELIVERED" as const, delivered_at: now };

  const { data: updated, error: updateError } = await supabase
    .from("deliveries")
    .update(patch)
    .eq("order_id", orderId)
    .is("transporter_id", null)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { error: "Could not update this order — it may have already moved on." };
  }
  if (updated) {
    return { success: true };
  }

  const { data: existing } = await supabase
    .from("deliveries")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existing) {
    return {
      error: "A delivery partner has already claimed this delivery. Use Admin Override to intervene.",
    };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("delivery_address, delivery_fee")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) {
    return { error: "Could not update this order — it may have already moved on." };
  }

  // Phase E, checkpoint E-1: guard_delivery_status_update() (0018, extended
  // by 0020) only fires BEFORE UPDATE, so its in_transit_at COALESCE never
  // runs for a brand-new row created directly at IN_TRANSIT — this is the
  // one INSERT-only path that can reach IN_TRANSIT without ever passing
  // through that trigger. Set explicitly here, and only here: never added
  // to `patch` itself, since `patch` is also reused by the UPDATE call
  // above, and sending in_transit_at on that UPDATE would ride past the
  // trigger's guard on any subsequent re-fire and silently overwrite an
  // already-set timestamp — the exact overwrite Phase E's timestamp
  // invariant exists to prevent.
  const { error: insertError } = await supabase.from("deliveries").insert({
    order_id: orderId,
    pickup_location: "Farm pickup — coordinated by admin",
    delivery_location: order.delivery_address,
    delivery_fee: order.delivery_fee,
    transporter_id: null,
    ...patch,
    ...(orderStatus === "OUT_FOR_DELIVERY" ? { in_transit_at: now } : {}),
  });

  if (insertError) {
    return { error: "Could not update this order — it may have already moved on." };
  }

  return { success: true };
}

const OVERRIDE_ALLOWED = new Set(["OUT_FOR_DELIVERY", "DELIVERED"]);

/**
 * Phase D, checkpoint D1 — the explicit, separately-audited admin
 * intervention on a delivery a partner has already claimed. This never
 * fires as a side effect of the ordinary updateOrderStatus() buttons above;
 * those reject outright once transporter_id is set. It is a distinct,
 * intentionally invoked action, matching the approved design's requirement
 * that admin intervention on a claimed delivery be "a separate, explicit
 * admin override action — never the same button behaving differently based
 * on hidden state."
 *
 * Authorization: re-derives admin identity from the authenticated session
 * exactly like updateOrderStatus() above — no client-supplied admin id, and
 * no new authorization system. The delivery write goes through the caller's
 * own RLS-respecting session: deliveries_admin_write (0002_rls.sql) already
 * grants admin an unconditional write on this table — the same grant the
 * ordinary sync above has always relied on — so no service-role escalation
 * is needed for it. Only the audit_logs insert escalates to the service-role
 * client, since audit_logs has no client-insert policy for any role, the
 * same pattern claimDelivery()/markDeliveryFailed()
 * (src/lib/actions/delivery-partner.ts) and admin.ts already establish.
 *
 * Race safety: the delivery UPDATE is conditioned on the row's own current
 * status, read immediately beforehand (optimistic concurrency) — if the row
 * changes between that read and this write (a second admin's override, or
 * anything else), the WHERE clause matches zero rows and this action
 * reports the conflict instead of silently overwriting it.
 *
 * Deliberately narrow, per the approved D1 scope: forces deliveries.status
 * and orders.order_status forward exactly the way the ordinary path would
 * have for an unclaimed delivery. It does not touch transporter_id (no
 * reassignment) and carries no reason field — both explicitly deferred
 * past this checkpoint.
 */
export async function adminOverrideDeliveryStatus(
  orderId: string,
  status: string
): Promise<ActionResult> {
  if (!OVERRIDE_ALLOWED.has(status)) {
    return { error: "That override isn't available." };
  }
  const nextStatus = status as "OUT_FOR_DELIVERY" | "DELIVERED";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return { error: "Admin access required." };
  }

  const { data: current } = await supabase
    .from("deliveries")
    .select("id, status, transporter_id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (!current) {
    return { error: "No delivery exists for this order yet." };
  }
  if (current.transporter_id === null) {
    return { error: "This delivery hasn't been claimed — use the ordinary action instead." };
  }

  const now = new Date().toISOString();
  const patch =
    nextStatus === "OUT_FOR_DELIVERY"
      ? { status: "IN_TRANSIT" as const, picked_up_at: now }
      : { status: "DELIVERED" as const, delivered_at: now };

  const { data: updated, error: updateError } = await supabase
    .from("deliveries")
    .update(patch)
    .eq("id", current.id)
    .eq("status", current.status)
    .select("id, transporter_id")
    .maybeSingle();

  if (updateError) {
    return { error: "Could not override this delivery. Please try again." };
  }
  if (!updated) {
    return { error: "This delivery changed since you loaded the page. Please refresh and try again." };
  }

  const { error: orderError } = await supabase
    .from("orders")
    .update({ order_status: nextStatus as OrderStatus })
    .eq("id", orderId);

  if (orderError) {
    return { error: "The delivery was overridden, but the order status could not be updated. Please refresh." };
  }

  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "delivery_admin_override",
    entity_type: "deliveries",
    entity_id: current.id,
    metadata: {
      order_id: orderId,
      previous_status: current.status,
      new_status: patch.status,
      previous_transporter_id: current.transporter_id,
      new_transporter_id: updated.transporter_id,
    },
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { success: true };
}

const CANCELLABLE_ORDER_STATUS = "PENDING_PAYMENT";
// Blocks cancellation while a payment attempt is actively resolving —
// narrows, but does not eliminate, the residual risk documented below.
const CANCEL_BLOCKED_PAYMENT_STATUSES = "(PAID,STK_SENT,PROCESSING)";

/**
 * Phase D, checkpoints D3 + D5. Cancels an order that has never been paid.
 * Used by both the buyer (their own order only) and admin (any order) — a
 * single atomic conditional UPDATE with the caller's authorization baked
 * directly into its WHERE clause, the same "ownership and state, not a
 * separate check" pattern advanceDeliveryStatus() and D1's
 * adminOverrideDeliveryStatus() above already use.
 *
 * Scoped to PENDING_PAYMENT only, per the approved D3 design: an order in
 * this state has never had inventory deducted (deduct_product_inventory()
 * only ever runs inside confirm_mpesa_payment(), supabase/migrations/0006_mpesa.sql)
 * and can have no deliveries row yet (createDeliveryJob() below only fires
 * at READY_FOR_DELIVERY, which requires CONFIRMED, which requires PAID) —
 * so there is nothing to restock and nothing to reconcile on the delivery
 * side. A PAID order that genuinely needs cancelling goes through the
 * existing dispute mechanism (src/lib/actions/disputes.ts) instead; this
 * action never creates a dispute, a REFUNDED state, or any fabricated
 * payment outcome.
 *
 * KNOWN RESIDUAL RISK, accepted for this phase per the approved D3 review:
 * confirm_mpesa_payment() has no order_status guard of its own — it writes
 * payment_status/order_status unconditionally once a callback arrives. The
 * CANCEL_BLOCKED_PAYMENT_STATUSES condition below blocks cancellation while
 * a push is already STK_SENT/PROCESSING, but cannot protect against a push
 * that was in flight and later confirms *after* this UPDATE has already
 * committed CANCELLED — that confirmation would still silently overwrite
 * order_status back to CONFIRMED and deduct inventory. Closing this fully
 * requires a guard inside confirm_mpesa_payment() itself, which touches
 * M-PESA database code and was explicitly deferred out of this checkpoint's
 * scope, not fixed here.
 *
 * Both actors write through the service-role client: RLS grants a buyer no
 * update policy on `orders` at all (confirmed against every `create policy
 * ... on public.orders` in supabase/migrations — only
 * orders_update_farmer_of_order and orders_update_admin_only exist), so a
 * buyer-scoped client cannot perform this write regardless of shape; admin's
 * own orders_update_admin_only would allow the RLS-respecting client, but
 * unifying both actors on one atomic statement (ownership OR admin, baked
 * into the same WHERE) is what keeps this a single conditional UPDATE
 * instead of two diverging code paths, so both go through service-role once
 * identity/role is already established via the RLS-respecting client below —
 * the same verify-then-escalate pattern used throughout src/lib/actions.
 */
export async function cancelOrder(orderId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  const isAdmin = profile?.role === "admin";

  const admin = createAdminClient();
  let query = admin
    .from("orders")
    .update({ order_status: "CANCELLED" as OrderStatus })
    .eq("id", orderId)
    .eq("order_status", CANCELLABLE_ORDER_STATUS)
    .not("payment_status", "in", CANCEL_BLOCKED_PAYMENT_STATUSES);

  if (!isAdmin) {
    query = query.eq("buyer_id", user.id);
  }

  const { data: cancelled, error } = await query.select("id, buyer_id").maybeSingle();

  if (error) {
    return { error: "Could not cancel this order. Please try again." };
  }
  if (!cancelled) {
    return { error: "This order can no longer be cancelled." };
  }

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "order_cancelled",
    entity_type: "orders",
    entity_id: orderId,
  });

  // D5: only an admin-initiated cancellation notifies the buyer — a buyer
  // cancelling their own order already knows. notify_order_status_change()
  // (0008_orders_lifecycle.sql) has no CANCELLED case in its switch, so it
  // never fires here regardless of actor — this is the only notification
  // this transition produces, and it's actor-conditional by construction.
  if (isAdmin) {
    await admin.from("notifications").insert({
      user_id: cancelled.buyer_id,
      type: "order_update",
      title: "Order cancelled",
      message: "Your order was cancelled by our team.",
      data: { order_id: orderId },
    });
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/dashboard/buyer/orders");
  revalidatePath("/admin/orders");
  return { success: true };
}

/**
 * Creates the UNASSIGNED delivery job the moment a farmer marks their order
 * READY_FOR_DELIVERY (Phase C, checkpoint C3). Reads happen through the
 * farmer's own RLS-respecting session — is_farmer_of_order() already grants
 * them their own order and farmer_profiles row. The insert itself has to go
 * through the service-role client: per the approved Phase C design, a
 * farmer never gets a write grant on `deliveries` at all (0018's RLS only
 * grants eligible delivery partners and admin), so this mirrors the
 * verify-then-escalate pattern already used elsewhere in src/lib/actions
 * (e.g. admin.ts's audit_logs insert) rather than attempting a write RLS
 * would reject.
 *
 * Deliberately does not touch orders.order_status or any other order
 * field, and does not sync deliveries.status back to orders — that
 * direction is C5's job, via the service-role client from within the
 * partner's own status-advance action, never a database trigger (see the
 * Phase C design's §12 risk callout on why a trigger-driven sync would
 * reintroduce the 0008→0013→0014 auth.role() bug).
 */
async function createDeliveryJob(supabase: Awaited<ReturnType<typeof createClient>>, orderId: string) {
  const { data: order } = await supabase
    .from("orders")
    .select("delivery_address, delivery_fee, farmer_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;

  const { data: farmerProfile } = await supabase
    .from("farmer_profiles")
    .select("farm_name, county, location")
    .eq("id", order.farmer_id)
    .maybeSingle();

  const pickupLocation =
    farmerProfile?.location?.trim() ||
    `${farmerProfile?.farm_name ?? "Farm"}, ${farmerProfile?.county ?? ""}`.trim();

  const admin = createAdminClient();
  // deliveries.order_id is unique (0001_init.sql): if a job already exists
  // for this order (the same transition firing twice), the insert fails
  // with 23505 and is silently a no-op — the same idempotent-insert
  // pattern createDeliveryPartnerProfile already relies on for the
  // analogous unique-user_id case. Errors here are non-fatal to the
  // overall status update, consistent with syncDelivery() above not
  // checking its own update/insert results either.
  await admin.from("deliveries").insert({
    order_id: orderId,
    pickup_location: pickupLocation,
    delivery_location: order.delivery_address,
    delivery_fee: order.delivery_fee,
    status: "UNASSIGNED",
    transporter_id: null,
  });
}
