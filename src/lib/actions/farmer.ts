"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
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

  const { error } = await supabase.from("farmer_profiles").insert({
    user_id: user.id,
    farm_name: farmName,
    county,
    subcounty: subcounty || null,
    location: location || null,
    farm_description: farmDescription || null,
    main_crops: parseMainCrops(mainCrops),
  });

  if (error) {
    // Unique constraint on user_id means a profile already exists.
    if (error.code === "23505") {
      return { error: "You already have a farm profile." };
    }
    return { error: "Could not create your farm profile. Please try again." };
  }

  revalidatePath("/dashboard/farmer");
  return { success: true };
}
