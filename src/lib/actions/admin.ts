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

/**
 * Admin-only, mirroring setFarmerVerification() above. requireAdmin()
 * already re-verifies the caller is an admin via the RLS-respecting
 * client before this UPDATE runs — the write itself then also has to
 * clear delivery_partner_profiles_update_own_or_admin (RLS) and
 * guard_delivery_partner_verification_update() (0017's column guard),
 * both of which already allow any change once is_admin() is true. A
 * delivery partner calling this directly would fail at the requireAdmin()
 * check here, and even if that check were somehow bypassed, the same
 * database trigger that blocks a partner from self-approving still
 * applies underneath — this action doesn't weaken or route around it in
 * any way.
 *
 * No notification is sent on verify/reject here — unlike farmer
 * verification, which reuses the existing 'farmer_verified'/
 * 'farmer_rejected' notification_type enum values, there is no
 * delivery-partner equivalent yet. Adding one would require a new
 * migration (ALTER TYPE ... ADD VALUE on notification_type), which is
 * out of scope for B5 per the approved Phase B design (notifications are
 * explicitly deferred). The audit_logs write below needs no such
 * migration — action/entity_type are plain text columns, not enums.
 */
async function setDeliveryPartnerVerification(
  deliveryPartnerProfileId: string,
  status: "verified" | "rejected"
): Promise<ActionResult> {
  const { supabase, adminId } = await requireAdmin();
  if (!adminId) {
    return { error: "Admin access required." };
  }

  const { data: partner, error } = await supabase
    .from("delivery_partner_profiles")
    .update({
      verification_status: status,
      verified_at: new Date().toISOString(),
      verified_by: adminId,
    })
    .eq("id", deliveryPartnerProfileId)
    .select("user_id")
    .single();

  if (error || !partner) {
    return { error: "Could not update verification status." };
  }

  // Audit log only (see doc comment above for why no notification is
  // sent yet) — service-role client because audit_logs has no
  // client-side insert policy for any role. Admin status was already
  // verified above via the RLS-respecting client.
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: adminId,
    action: status === "verified" ? "delivery_partner_verified" : "delivery_partner_rejected",
    entity_type: "delivery_partner_profiles",
    entity_id: deliveryPartnerProfileId,
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function verifyDeliveryPartner(deliveryPartnerProfileId: string) {
  return setDeliveryPartnerVerification(deliveryPartnerProfileId, "verified");
}

export async function rejectDeliveryPartner(deliveryPartnerProfileId: string) {
  return setDeliveryPartnerVerification(deliveryPartnerProfileId, "rejected");
}
