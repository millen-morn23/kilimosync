import { createClient } from "@/lib/supabase/server";
import type { Database, DeliveryStatus } from "@/lib/supabase/types";

export type CurrentUser = Database["public"]["Tables"]["users"]["Row"];
export type FarmerProfile = Database["public"]["Tables"]["farmer_profiles"]["Row"];
export type DeliveryPartnerProfile = Database["public"]["Tables"]["delivery_partner_profiles"]["Row"];
export type AvailableDeliveryJob = Pick<
  Database["public"]["Tables"]["deliveries"]["Row"],
  "id" | "pickup_location" | "delivery_fee" | "created_at"
>;
export type ActiveDelivery = {
  id: string;
  status: DeliveryStatus;
  pickupLocation: string;
  deliveryFee: number;
  buyerName: string;
  buyerPhone: string;
  deliveryAddress: string;
  deliveryNotes: string | null;
};

const ACTIVE_DELIVERY_STATUSES: DeliveryStatus[] = ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"];

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // No Supabase project connected to this environment yet — treat every
  // request as unauthenticated (redirects to /login) instead of throwing
  // a raw connection error into a protected page. See docs/DEPLOYMENT.md.
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data } = await supabase.from("users").select("*").eq("id", authUser.id).single();
  return data;
}

export async function getOwnFarmerProfile(): Promise<FarmerProfile | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data } = await supabase
    .from("farmer_profiles")
    .select("*")
    .eq("user_id", authUser.id)
    .maybeSingle();
  return data;
}

export async function getOwnDeliveryPartnerProfile(): Promise<DeliveryPartnerProfile | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data } = await supabase
    .from("delivery_partner_profiles")
    .select("*")
    .eq("user_id", authUser.id)
    .maybeSingle();
  return data;
}

/**
 * Delivery jobs an eligible partner can claim (Phase C, checkpoint C4).
 * Eligibility (verified, available, not suspended, matching operating
 * county) is enforced entirely by deliveries_select_available_for_eligible_partners
 * (0018_delivery_assignment.sql) via the RLS-respecting client — this
 * function does not re-check any of that itself, per the approved Phase C
 * design's instruction not to duplicate database-level security in
 * application code. The `.eq("status", ...)` filter below is redundant
 * with what the policy already enforces; it's kept for the same reason
 * getOwnFarmerProfile()/getOwnDeliveryPartnerProfile() above still filter
 * by their own owning id even though RLS would also block a mismatch.
 *
 * Column selection deliberately excludes delivery_location (the buyer's
 * exact address) and every orders/order_items field — per the design's §7,
 * a partner sees only pickup location and fee before claiming; the full
 * order only becomes visible after assignment via
 * orders_select_assigned_delivery_partner (also 0018).
 */
export async function getAvailableDeliveryJobs(): Promise<AvailableDeliveryJob[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return [];

  const { data } = await supabase
    .from("deliveries")
    .select("id, pickup_location, delivery_fee, created_at")
    .eq("status", "UNASSIGNED")
    .order("created_at", { ascending: true });

  return data ?? [];
}

/**
 * The signed-in delivery partner's own active (claimed, not yet delivered
 * or failed) delivery, for the C6 dashboard card. transporter_id always
 * comes from auth.getUser(), never a client-supplied value.
 *
 * The deliveries row itself is readable via
 * deliveries_select_participants_or_admin's transporter_id = auth.uid()
 * branch (0002_rls.sql, unmodified — predates and is untouched by 0018).
 * The order lookup uses orders_select_assigned_delivery_partner (0018),
 * which only grants a row once this delivery's transporter_id already
 * matches the caller — so an unassigned or someone-else's delivery is
 * simply unreachable here, not filtered after the fact. Only order-level
 * fields are read; order_items is never queried, since no RLS grant
 * exists there for a delivery partner (confirmed by inspection — 0018
 * adds no order_items policy), matching §7 of the Phase C design, which
 * only ever describes the partner getting the full *orders* row.
 *
 * .limit(1) guards against the known, out-of-scope-for-C6 gap where a
 * partner can currently hold more than one active delivery (eligibility
 * has no such check) — this just deterministically picks the
 * longest-claimed one rather than erroring on an unexpected multi-row
 * result; it does not fix that gap.
 */
export async function getActiveDelivery(): Promise<ActiveDelivery | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data: delivery } = await supabase
    .from("deliveries")
    .select("id, order_id, status, pickup_location, delivery_fee")
    .eq("transporter_id", authUser.id)
    .in("status", ACTIVE_DELIVERY_STATUSES)
    .order("assigned_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!delivery) return null;

  const { data: order } = await supabase
    .from("orders")
    .select("buyer_name, buyer_phone, delivery_address, delivery_notes")
    .eq("id", delivery.order_id)
    .maybeSingle();
  if (!order) return null;

  return {
    id: delivery.id,
    status: delivery.status,
    pickupLocation: delivery.pickup_location,
    deliveryFee: delivery.delivery_fee,
    buyerName: order.buyer_name,
    buyerPhone: order.buyer_phone,
    deliveryAddress: order.delivery_address,
    deliveryNotes: order.delivery_notes,
  };
}
