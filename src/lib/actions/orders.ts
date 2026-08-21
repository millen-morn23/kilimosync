"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
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
