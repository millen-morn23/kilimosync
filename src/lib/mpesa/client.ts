import "server-only";

import type { MpesaConfig } from "@/lib/mpesa/config";
import type { DarajaStkCallback, ParsedCallback, StkPushResult } from "@/lib/mpesa/types";

/** Kenyan mobile number, any common input shape, normalized to 2547XXXXXXXX / 2541XXXXXXXX. */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  const match = digits.match(/^(?:254|0)?([17]\d{8})$/);
  if (!match) return null;
  return `254${match[1]}`;
}

async function getAccessToken(config: MpesaConfig): Promise<string> {
  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString(
    "base64"
  );
  const res = await fetch(`${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`M-PESA auth failed (${res.status})`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function darajaTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

export async function initiateStkPush(
  config: MpesaConfig,
  params: { phone: string; amount: number; accountReference: string; description: string }
): Promise<StkPushResult> {
  let accessToken: string;
  try {
    accessToken = await getAccessToken(config);
  } catch {
    return { ok: false, error: "Could not reach M-PESA. Please try again shortly." };
  }

  const timestamp = darajaTimestamp();
  const password = Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString(
    "base64"
  );

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: config.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(params.amount),
        PartyA: params.phone,
        PartyB: config.shortcode,
        PhoneNumber: params.phone,
        CallBackURL: config.callbackUrl,
        AccountReference: params.accountReference.slice(0, 12),
        TransactionDesc: params.description.slice(0, 13),
      }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Could not reach M-PESA. Please try again shortly." };
  }

  const data = (await res.json().catch(() => null)) as {
    ResponseCode?: string;
    MerchantRequestID?: string;
    CheckoutRequestID?: string;
    errorMessage?: string;
  } | null;

  if (!res.ok || !data || data.ResponseCode !== "0" || !data.CheckoutRequestID) {
    return { ok: false, error: "M-PESA declined the payment request. Please try again." };
  }

  return {
    ok: true,
    merchantRequestId: data.MerchantRequestID!,
    checkoutRequestId: data.CheckoutRequestID,
  };
}

export function parseStkCallback(body: DarajaStkCallback): ParsedCallback | null {
  const callback = body?.Body?.stkCallback;
  if (!callback || !callback.CheckoutRequestID || !callback.MerchantRequestID) return null;

  const items = callback.CallbackMetadata?.Item ?? [];
  const get = (name: string) => items.find((i) => i.Name === name)?.Value ?? null;

  return {
    merchantRequestId: callback.MerchantRequestID,
    checkoutRequestId: callback.CheckoutRequestID,
    resultCode: callback.ResultCode,
    resultDesc: callback.ResultDesc,
    amount: typeof get("Amount") === "number" ? (get("Amount") as number) : null,
    mpesaReceiptNumber: (get("MpesaReceiptNumber") as string) ?? null,
    transactionDate: get("TransactionDate") ? String(get("TransactionDate")) : null,
    phoneNumber: get("PhoneNumber") ? String(get("PhoneNumber")) : null,
  };
}

/** Maps a non-zero Daraja ResultCode to our payment_status vocabulary. */
export function mapResultCodeToStatus(resultCode: number): "CANCELLED" | "TIMEOUT" | "FAILED" {
  if (resultCode === 1032) return "CANCELLED"; // Request cancelled by user
  if (resultCode === 1037) return "TIMEOUT"; // Timeout awaiting user input
  return "FAILED"; // Insufficient funds, wrong PIN, and everything else
}
