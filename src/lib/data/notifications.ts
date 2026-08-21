import { createClient } from "@/lib/supabase/server";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

// RLS (notifications_owner_select) already restricts this to the caller's
// own rows — no user_id filter needed here to be correct, but the .eq()
// keeps the query explicit about intent.
export async function getNotifications(limit = 30): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, message, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  return count ?? 0;
}
