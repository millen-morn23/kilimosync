import { createClient } from "@/lib/supabase/server";

export type Category = { id: string; name: string; slug: string; icon: string | null };

export async function getCategories(): Promise<Category[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, icon")
    .order("name");
  if (error) console.error("getCategories query failed", error);
  return data ?? [];
}

export async function getCategoryProductCounts(): Promise<Record<string, number>> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return {};

  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("category_id")
    .eq("status", "active");

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    if (!row.category_id) continue;
    counts[row.category_id] = (counts[row.category_id] ?? 0) + 1;
  }
  return counts;
}
