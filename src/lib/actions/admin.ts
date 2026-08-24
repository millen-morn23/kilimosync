"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = { error: string } | { success: true };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, adminId: null };

  const { data } = await supabase.from("users").select("role").eq("id", user.id).single();
  return { supabase, adminId: data?.role === "admin" ? user.id : null };
}

async function setFarmerVerification(
  farmerProfileId: string,
  status: "verified" | "rejected"
): Promise<ActionResult> {
  const { supabase, adminId } = await requireAdmin();
  if (!adminId) {
    return { error: "Admin access required." };
  }

  const { data: farmer, error } = await supabase
    .from("farmer_profiles")
    .update({
      verification_status: status,
      verified_at: new Date().toISOString(),
      verified_by: adminId,
    })
    .eq("id", farmerProfileId)
    .select("user_id, farm_name")
    .single();

  if (error || !farmer) {
    return { error: "Could not update verification status." };
  }

  // Audit log and notification require the service-role client because
  // RLS intentionally allows no client-side inserts on either table
  // (see supabase/migrations/0002_rls.sql). Admin status was already
  // verified above via the RLS-respecting client, so this is safe.
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: adminId,
    action: status === "verified" ? "farmer_verified" : "farmer_rejected",
    entity_type: "farmer_profiles",
    entity_id: farmerProfileId,
  });
  await admin.from("notifications").insert({
    user_id: farmer.user_id,
    type: status === "verified" ? "farmer_verified" : "farmer_rejected",
    title: status === "verified" ? "Your farm is verified" : "Verification update",
    message:
      status === "verified"
        ? `${farmer.farm_name} has been verified. Your listings will now show a verified badge.`
        : `${farmer.farm_name} was not approved for verification. Contact support for details.`,
    data: { farmer_profile_id: farmerProfileId },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function verifyFarmer(farmerProfileId: string) {
  return setFarmerVerification(farmerProfileId, "verified");
}

export async function rejectFarmer(farmerProfileId: string) {
  return setFarmerVerification(farmerProfileId, "rejected");
}
