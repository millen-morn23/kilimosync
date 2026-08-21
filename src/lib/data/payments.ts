import { createClient } from "@/lib/supabase/server";

export type PaymentRow = {
  id: string;
  order_id: string;
  amount: number;
  phone_number: string;
  status: string;
  mpesa_receipt_number: string | null;
  result_description: string | null;
  created_at: string;
  completed_at: string | null;
};

export type PaymentStats = {
  paid: number;
  pendingOrInFlight: number;
  failed: number;
  grossTransactionValue: number;
};

/**
 * Admin-only reads. RLS (`payments_select_buyer_or_admin`) already
 * restricts these to admins server-side — this is a convenience layer,
 * not the authorization boundary.
 */
export async function getRecentPayments(limit = 50): Promise<PaymentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select(
      "id, order_id, amount, phone_number, status, mpesa_receipt_number, result_description, created_at, completed_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function getPaymentStats(): Promise<PaymentStats> {
  const supabase = await createClient();
  const { data } = await supabase.from("payments").select("status, amount");

  const rows = data ?? [];
  return {
    paid: rows.filter((r) => r.status === "PAID").length,
    pendingOrInFlight: rows.filter((r) => r.status === "PENDING" || r.status === "STK_SENT" || r.status === "PROCESSING")
      .length,
    failed: rows.filter((r) => r.status === "FAILED" || r.status === "CANCELLED" || r.status === "TIMEOUT")
      .length,
    grossTransactionValue: rows.filter((r) => r.status === "PAID").reduce((sum, r) => sum + r.amount, 0),
  };
}
