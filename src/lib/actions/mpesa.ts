"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMpesaConfig } from "@/lib/mpesa/config";
import { initiateStkPush, normalizeKenyanPhone } from "@/lib/mpesa/client";
import { mpesaPhoneSchema } from "@/lib/validation/mpesa";

type ActionResult = { error: string } | { success: true };

const RETRYABLE_STATUSES = new Set(["PENDING", "FAILED", "CANCELLED", "TIMEOUT"]);

/**
 * Triggers an STK push for an existing order. Never accepts an amount
 * from the client — it's always re-read from `orders.total_amount`, which
 * was itself computed server-side at checkout (see
 * src/lib/actions/checkout.ts). Writing the resulting payment row and
 * bumping order.payment_status happens inside record_stk_initiation()
 * (supabase/migrations/0006_mpesa.sql) via the service-role client — see
 * that migration's header comment for why a buyer-scoped client can't do
 * this directly.
 */
export async function initiatePayment(orderId: string, phoneInput: string): Promise<ActionResult> {
  const phoneCheck = mpesaPhoneSchema.safeParse(phoneInput);
  if (!phoneCheck.success) {
    return { error: phoneCheck.error.issues[0]?.message ?? "Enter a valid phone number." };
  }
  const phone = normalizeKenyanPhone(phoneCheck.data);
  if (!phone) {
    return { error: "Enter a valid Safaricom number, e.g. 0712 345 678." };
  }

  const config = getMpesaConfig();
  if ("error" in config) {
    return { error: config.error };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // RLS (orders_select_buyer_farmer_admin) guarantees this only returns a
  // row when the order actually belongs to this buyer.
  const { data: order } = await supabase
    .from("orders")
    .select("id, total_amount, payment_status, buyer_id")
    .eq("id", orderId)
    .eq("buyer_id", user.id)
    .maybeSingle();

  if (!order) return { error: "Order not found." };
  if (!RETRYABLE_STATUSES.has(order.payment_status)) {
    return order.payment_status === "PAID"
      ? { error: "This order has already been paid." }
      : { error: "A payment is already in progress for this order." };
  }

  const stkResult = await initiateStkPush(config, {
    phone,
    amount: order.total_amount,
    accountReference: order.id.slice(0, 12),
    description: "KilimoSync",
  });

  if (!stkResult.ok) {
    return { error: stkResult.error };
  }

  const admin = createAdminClient();
  const { data: paymentId, error: rpcError } = await admin.rpc("record_stk_initiation", {
    p_order_id: order.id,
    p_buyer_id: user.id,
    p_amount: order.total_amount,
    p_phone: phone,
    p_merchant_request_id: stkResult.merchantRequestId,
    p_checkout_request_id: stkResult.checkoutRequestId,
  });

  if (rpcError || !paymentId) {
    return { error: "Could not start payment for this order. Please try again." };
  }

  revalidatePath(`/orders/${orderId}`);
  return { success: true };
}

/**
 * Lightweight poll target for the "Check your phone" screen. Returns null
 * if the order doesn't belong to the caller (RLS), so the client can't
 * use this to probe other buyers' orders.
 */
export async function getOrderPaymentStatus(
  orderId: string
): Promise<{ paymentStatus: string; orderStatus: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("orders")
    .select("payment_status, order_status")
    .eq("id", orderId)
    .eq("buyer_id", user.id)
    .maybeSingle();

  if (!data) return null;
  return { paymentStatus: data.payment_status, orderStatus: data.order_status };
}
