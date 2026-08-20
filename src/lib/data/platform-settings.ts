import { createClient } from "@/lib/supabase/server";

const DEFAULT_FEE_PERCENT = 5;

export async function getPlatformFeePercent(): Promise<number> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return DEFAULT_FEE_PERCENT;

  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("platform_fee_percent")
    .eq("id", 1)
    .maybeSingle();

  return data?.platform_fee_percent ?? DEFAULT_FEE_PERCENT;
}
