import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

/**
 * Service-role Supabase client. Bypasses Row Level Security.
 *
 * NEVER import this outside of: M-PESA callback handlers, AI server tools
 * that have already verified the caller's role, and admin-only route
 * handlers. The `server-only` import guarantees a build-time failure if
 * this module is ever pulled into client code.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Admin client is unavailable."
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
