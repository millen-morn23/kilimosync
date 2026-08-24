"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createFarmerProfileSchema,
  parseMainCrops,
  type CreateFarmerProfileInput,
} from "@/lib/validation/farmer";

type ActionResult = { error: string } | { success: true };

export async function createFarmerProfile(
  input: CreateFarmerProfileInput
): Promise<ActionResult> {
  const parsed = createFarmerProfileSchema.safeParse(input);
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

  const { farmName, county, subcounty, location, farmDescription, mainCrops } = parsed.data;

  const { data: profile, error } = await supabase
    .from("farmer_profiles")
    .insert({
      user_id: user.id,
      farm_name: farmName,
      county,
      subcounty: subcounty || null,
      location: location || null,
      farm_description: farmDescription || null,
      main_crops: parseMainCrops(mainCrops),
    })
    .select("id")
    .single();

  if (error || !profile) {
    // Unique constraint on user_id means a profile already exists.
    if (error?.code === "23505") {
      return { error: "You already have a farm profile." };
    }
    return { error: "Could not create your farm profile. Please try again." };
  }

  const admin = createAdminClient();
  const { data: admins } = await admin.from("users").select("id").eq("role", "admin");
  if (admins && admins.length > 0) {
    await admin.from("notifications").insert(
      admins.map((a) => ({
        user_id: a.id,
        type: "new_farmer_signup" as const,
        title: "New farmer signed up",
        message: `${farmName} in ${county} joined and is awaiting verification.`,
        data: { farmer_profile_id: profile.id },
      }))
    );
  }

  revalidatePath("/dashboard/farmer");
  return { success: true };
}

/**
 * RLS (farmer_profiles_update_own_or_admin, 0002_rls.sql) already scopes
 * this update to the caller's own row, and the guard_farmer_verification_update
 * trigger blocks changes to verification_status/verified_at/verified_by for
 * non-admins regardless of what's sent — this whitelist just doesn't
 * attempt to touch those columns in the first place.
 */
export async function updateFarmerProfile(
  input: CreateFarmerProfileInput
): Promise<ActionResult> {
  const parsed = createFarmerProfileSchema.safeParse(input);
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

  const { farmName, county, subcounty, location, farmDescription, mainCrops } = parsed.data;

  const { error } = await supabase
    .from("farmer_profiles")
    .update({
      farm_name: farmName,
      county,
      subcounty: subcounty || null,
      location: location || null,
      farm_description: farmDescription || null,
      main_crops: parseMainCrops(mainCrops),
    })
    .eq("user_id", user.id);

  if (error) {
    return { error: "Could not update your farm profile. Please try again." };
  }

  revalidatePath("/dashboard/farmer");
  return { success: true };
}
