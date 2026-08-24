import { createClient } from "@/lib/supabase/server";

export type NotificationData = {
  order_id?: string;
  dispute_id?: string;
  product_id?: string;
  farmer_profile_id?: string;
};

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  data: NotificationData;
  read_at: string | null;
  created_at: string;
};

export type NotificationsPage = {
  notifications: NotificationRow[];
  total: number;
  page: number;
  pageSize: number;
};

const DEFAULT_NOTIFICATIONS_PAGE_SIZE = 20;

// RLS (notifications_owner_select) already restricts this to the caller's
// own rows — no user_id filter needed here to be correct, but the .eq()
// keeps the query explicit about intent.
export async function getNotifications(
  page = 1,
  pageSize = DEFAULT_NOTIFICATIONS_PAGE_SIZE
): Promise<NotificationsPage> {
  const empty = { notifications: [], total: 0, page, pageSize };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const from = (page - 1) * pageSize;
  const { data, count } = await supabase
    .from("notifications")
    .select("id, type, title, message, data, read_at, created_at", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  return {
    notifications: (data ?? []) as NotificationRow[],
    total: count ?? 0,
    page,
    pageSize,
  };
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
