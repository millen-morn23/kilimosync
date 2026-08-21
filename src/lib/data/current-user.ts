import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type CurrentUser = Database["public"]["Tables"]["users"]["Row"];
export type FarmerProfile = Database["public"]["Tables"]["farmer_profiles"]["Row"];

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // No Supabase project connected to this environment yet — treat every
  // request as unauthenticated (redirects to /login) instead of throwing
  // a raw connection error into a protected page. See docs/DEPLOYMENT.md.
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data } = await supabase.from("users").select("*").eq("id", authUser.id).single();
  return data;
}

export async function getOwnFarmerProfile(): Promise<FarmerProfile | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data } = await supabase
    .from("farmer_profiles")
    .select("*")
    .eq("user_id", authUser.id)
    .maybeSingle();
  return data;
}
