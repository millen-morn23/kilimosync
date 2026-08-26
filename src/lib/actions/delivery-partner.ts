"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createDeliveryPartnerProfileSchema,
  type CreateDeliveryPartnerProfileInput,
} from "@/lib/validation/delivery-partner";
import type { DeliveryAvailabilityStatus } from "@/lib/supabase/types";

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
