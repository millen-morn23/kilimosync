import { createClient } from "@/lib/supabase/server";

export type Category = { id: string; name: string; slug: string };

export async function getCategories(): Promise<Category[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];

  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name, slug").order("name");
  return data ?? [];
}
