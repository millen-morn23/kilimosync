import "server-only";

export type MpesaConfig = {
  environment: "sandbox" | "production";
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  callbackUrl: string;
};

/**
 * Reads and validates M-PESA env vars on demand (not at module load), so
 * the app builds and runs fine with no M-PESA credentials configured —
 * only the "Pay with M-PESA" action itself fails, with a clear message,
 * until real sandbox credentials are supplied. See docs/M-PESA.md.
 */
export function getMpesaConfig(): MpesaConfig | { error: string } {
  const environment = process.env.MPESA_ENVIRONMENT === "production" ? "production" : "sandbox";
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const passkey = process.env.MPESA_PASSKEY;
  const shortcode = process.env.MPESA_SHORTCODE;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;

  if (!consumerKey || !consumerSecret || !passkey || !shortcode || !callbackUrl) {
    return { error: "M-PESA is not configured in this environment." };
  }

  return {
    environment,
    baseUrl:
      environment === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke",
    consumerKey,
    consumerSecret,
    passkey,
    shortcode,
    callbackUrl,
  };
}

/**
 * Cheap boolean check for UI gating (e.g. disabling "Pay with M-PESA"
 * before the buyer fills in a phone number and submits) — avoids making
 * them discover misconfiguration only after they submit the form.
 */
export function isMpesaConfigured(): boolean {
  return !("error" in getMpesaConfig());
}
