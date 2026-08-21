"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { openDisputeSchema, type OpenDisputeInput } from "@/lib/validation/disputes";

type ActionResult = { error: string } | { success: true };

/**
 * RLS (disputes_insert_own_order, 0002_rls.sql) already restricts this to
 * the caller's own order — the .eq("buyer_id", ...) check here just
 * produces a clean error instead of a raw RLS rejection.
 */
export async function openDispute(input: OpenDisputeInput): Promise<ActionResult> {
  const parsed = openDisputeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", parsed.data.orderId)
    .eq("buyer_id", user.id)
    .maybeSingle();
  if (!order) return { error: "Order not found." };

  const { data: dispute, error } = await supabase
    .from("disputes")
    .insert({
      order_id: parsed.data.orderId,
      user_id: user.id,
      reason: parsed.data.reason,
      description: parsed.data.description,
    })
    .select("id")
    .single();

  if (error || !dispute) return { error: "Could not open a dispute. Please try again." };

  const admin = createAdminClient();
  const { data: admins } = await admin.from("users").select("id").eq("role", "admin");
  if (admins && admins.length > 0) {
    await admin.from("notifications").insert(
      admins.map((a) => ({
        user_id: a.id,
        type: "dispute_opened" as const,
        title: "New dispute opened",
        message: `A buyer opened a dispute on order ${parsed.data.orderId.slice(0, 8)}: ${parsed.data.reason}`,
      }))
    );
  }

  revalidatePath(`/orders/${parsed.data.orderId}`);
  return { success: true };
}

type AdminActionResult = { error: string } | { success: true };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, adminId: null };
  const { data } = await supabase.from("users").select("role").eq("id", user.id).single();
  return { supabase, adminId: data?.role === "admin" ? user.id : null };
}

export async function resolveDispute(
  disputeId: string,
  status: "investigating" | "resolved" | "rejected",
  adminResponse: string
): Promise<AdminActionResult> {
  const { supabase, adminId } = await requireAdmin();
  if (!adminId) return { error: "Admin access required." };

  const { data: dispute, error } = await supabase
    .from("disputes")
    .update({ status, admin_response: adminResponse || null })
    .eq("id", disputeId)
    .select("user_id, order_id")
    .single();

  if (error || !dispute) return { error: "Could not update this dispute." };

  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: adminId,
    action: `dispute_${status}`,
    entity_type: "disputes",
    entity_id: disputeId,
  });

  if (status === "resolved" || status === "rejected") {
    await admin.from("notifications").insert({
      user_id: dispute.user_id,
      type: "dispute_resolved",
      title: status === "resolved" ? "Your dispute was resolved" : "Your dispute was reviewed",
      message: adminResponse || "An admin has updated your dispute.",
    });
  }

  revalidatePath("/admin/disputes");
  return { success: true };
}
