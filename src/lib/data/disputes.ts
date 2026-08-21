import { createClient } from "@/lib/supabase/server";

export type DisputeRow = {
  id: string;
  order_id: string;
  reason: string;
  description: string;
  status: string;
  admin_response: string | null;
  created_at: string;
};

export async function getDisputeForOrder(orderId: string): Promise<DisputeRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("disputes")
    .select("id, order_id, reason, description, status, admin_response, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export type AdminDisputeRow = DisputeRow & { buyer_name: string };

export async function getAdminDisputes(): Promise<AdminDisputeRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("disputes")
    .select(
      "id, order_id, reason, description, status, admin_response, created_at, orders(buyer_name)"
    )
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => {
    const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
    return {
      id: row.id,
      order_id: row.order_id,
      reason: row.reason,
      description: row.description,
      status: row.status,
      admin_response: row.admin_response,
      created_at: row.created_at,
      buyer_name: order?.buyer_name ?? "Unknown buyer",
    };
  });
}
