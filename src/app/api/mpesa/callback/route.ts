import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { mapResultCodeToStatus, parseStkCallback } from "@/lib/mpesa/client";
import type { DarajaStkCallback } from "@/lib/mpesa/types";

// Daraja expects a fast 200 response in this exact shape regardless of
// what we did internally, or it will keep retrying the callback.
const ACK = NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

/**
 * Safaricom M-PESA callback. Daraja 3.0 does not sign callbacks, so
 * `docs/M-PESA.md` calls for a shared secret in the URL as the source
 * check — MPESA_CALLBACK_URL should be configured as
 * `https://<domain>/api/mpesa/callback?token=<MPESA_CALLBACK_SECRET>`.
 * This authenticates the *request*, not a user session — there is no
 * signed-in user on a server-to-server callback.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.MPESA_CALLBACK_SECRET;
  if (secret && request.nextUrl.searchParams.get("token") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: DarajaStkCallback;
  try {
    body = await request.json();
  } catch {
    return ACK;
  }

  const parsed = parseStkCallback(body);
  const admin = createAdminClient();

  if (!parsed) {
    await admin.from("audit_logs").insert({
      actor_id: null,
      action: "mpesa_callback_malformed",
      entity_type: "payments",
      entity_id: null,
      metadata: { raw: body as unknown as Record<string, unknown> },
    });
    return ACK;
  }

  const rawCallback = body as unknown as Record<string, unknown>;

  let outcome: string | null = null;
  if (parsed.resultCode === 0) {
    const { data, error } = await admin.rpc("confirm_mpesa_payment", {
      p_checkout_request_id: parsed.checkoutRequestId,
      p_receipt: parsed.mpesaReceiptNumber ?? "",
      p_result_code: parsed.resultCode,
      p_result_desc: parsed.resultDesc,
      p_raw: rawCallback,
    });
    if (!error) outcome = data;
  } else {
    const { data, error } = await admin.rpc("fail_mpesa_payment", {
      p_checkout_request_id: parsed.checkoutRequestId,
      p_status: mapResultCodeToStatus(parsed.resultCode),
      p_result_code: parsed.resultCode,
      p_result_desc: parsed.resultDesc,
      p_raw: rawCallback,
    });
    if (!error) outcome = data;
  }

  if (outcome === "unknown_checkout_request_id" || outcome === null) {
    await admin.from("audit_logs").insert({
      actor_id: null,
      action: "mpesa_callback_unmatched",
      entity_type: "payments",
      entity_id: null,
      metadata: { checkout_request_id: parsed.checkoutRequestId, outcome },
    });
  }

  return ACK;
}
