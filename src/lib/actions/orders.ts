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

  const { error } = await supabase
    .from("orders")
    .update({ order_status: status as OrderStatus })
    .eq("id", orderId);

  if (error) {
    return { error: "Could not update this order — it may have already moved on." };
  }

  if (role === "admin" && (status === "OUT_FOR_DELIVERY" || status === "DELIVERED")) {
    await syncDelivery(supabase, orderId, status);
  }

  if (role === "farmer" && status === "READY_FOR_DELIVERY") {
    await createDeliveryJob(supabase, orderId);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/dashboard/farmer/orders");
  revalidatePath("/admin/orders");
  return { success: true };
}

async function syncDelivery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  orderStatus: "OUT_FOR_DELIVERY" | "DELIVERED"
) {
  const { data: order } = await supabase
    .from("orders")
    .select("delivery_address, delivery_fee")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;

  const { data: existing } = await supabase
    .from("deliveries")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();

  const now = new Date().toISOString();
  const patch =
    orderStatus === "OUT_FOR_DELIVERY"
      ? { status: "IN_TRANSIT" as const, assigned_at: now, picked_up_at: now }
      : { status: "DELIVERED" as const, delivered_at: now };

  if (existing) {
    await supabase.from("deliveries").update(patch).eq("id", existing.id);
  } else {
    await supabase.from("deliveries").insert({
      order_id: orderId,
      pickup_location: "Farm pickup — coordinated by admin",
      delivery_location: order.delivery_address,
      delivery_fee: order.delivery_fee,
      ...patch,
    });
  }
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
