import { createClient } from "@/lib/supabase/server";
import type { DeliveryStatus, VehicleType } from "@/lib/supabase/types";

export type AssignedDeliveryPartner = {
  name: string;
  vehicleType: VehicleType;
};

export type OrderDeliveryInfo = {
  status: DeliveryStatus;
  transporterId: string | null;
  assignedPartner: AssignedDeliveryPartner | null;
  assignedAt: string | null;
  pickedUpAt: string | null;
  inTransitAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
};

/**
 * Delivery status + (only once assigned) the partner's name and vehicle
 * type, for one or more orders at a time (Phase C, checkpoint C6).
 * Batched rather than per-order to avoid N+1 queries from
 * getFarmerOrders() below.
 *
 * Every read here goes through the caller's own RLS-respecting session —
 * no new authorization system, no service-role client. The deliveries row
 * itself is readable via deliveries_select_participants_or_admin
 * (0002_rls.sql, unmodified: buyer_id/is_farmer_of_order/admin), so a
 * buyer or farmer already sees UNASSIGNED rows for their own order today —
 * assignedPartner is what's actually gated: it comes from
 * users_select_assigned_delivery_partner and
 * delivery_partner_profiles_select_for_order_participants (both 0018),
 * which only resolve once is_order_participant_of_delivery_partner()
 * matches an assigned transporter_id. transporter_id is null on every
 * unassigned row, so this function never even attempts (and RLS would
 * refuse) to resolve a partner before one exists — "only expose
 * assignment information when a partner is actually assigned" holds by
 * construction, not by an extra check here.
 *
 * Phase E, checkpoint E-3: also selects the five stage timestamps added by
 * 0020_delivery_tracking_timestamps.sql, so the tracking timeline
 * (src/components/orders/delivery-timeline.tsx) can render from data
 * already fetched here — no second query.
 */
async function getDeliveryInfoForOrders(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderIds: string[]
): Promise<Map<string, OrderDeliveryInfo>> {
  const result = new Map<string, OrderDeliveryInfo>();
  if (orderIds.length === 0) return result;

  const { data: deliveries } = await supabase
    .from("deliveries")
    .select(
      "order_id, status, transporter_id, assigned_at, picked_up_at, in_transit_at, delivered_at, failed_at"
    )
    .in("order_id", orderIds);
  if (!deliveries || deliveries.length === 0) return result;

  const transporterIds = [
    ...new Set(
      deliveries
        .map((d) => d.transporter_id)
        .filter((id): id is string => id !== null)
    ),
  ];

  const partnerByUserId = new Map<string, AssignedDeliveryPartner>();
  if (transporterIds.length > 0) {
    const [{ data: users }, { data: profiles }] = await Promise.all([
      supabase.from("users").select("id, name").in("id", transporterIds),
      supabase
        .from("delivery_partner_profiles")
        .select("user_id, vehicle_type")
        .in("user_id", transporterIds),
    ]);
    const vehicleByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p.vehicle_type]));
    for (const u of users ?? []) {
      const vehicleType = vehicleByUserId.get(u.id);
      if (vehicleType) partnerByUserId.set(u.id, { name: u.name, vehicleType });
    }
  }

  for (const d of deliveries) {
    result.set(d.order_id, {
      status: d.status,
      transporterId: d.transporter_id,
      assignedPartner: d.transporter_id ? partnerByUserId.get(d.transporter_id) ?? null : null,
      assignedAt: d.assigned_at,
      pickedUpAt: d.picked_up_at,
      inTransitAt: d.in_transit_at,
      deliveredAt: d.delivered_at,
      failedAt: d.failed_at,
    });
  }
  return result;
}

export type OrderListItem = {
  id: string;
  total_amount: number;
  payment_status: string;
  order_status: string;
  created_at: string;
  itemCount: number;
};

export type OrderItemDetail = {
  id: string;
  product_id: string | null;
  product_name_snapshot: string;
  price_at_purchase: number;
  quantity: number;
  subtotal: number;
  farmer_id: string;
};

export type OrderDetail = {
  id: string;
  buyer_id: string;
  buyer_name: string;
  buyer_phone: string;
  subtotal: number;
  delivery_fee: number;
  platform_fee: number;
  total_amount: number;
  payment_status: string;
  order_status: string;
  delivery_county: string;
  delivery_address: string;
  delivery_notes: string | null;
  created_at: string;
  items: OrderItemDetail[];
  delivery: OrderDeliveryInfo | null;
};

// RLS (supabase/migrations/0002_rls.sql, 0005_checkout_policies.sql)
// already restricts every query below to rows the caller is allowed to
// see — a buyer's own orders, or a farmer's orders via order_items — so
// these helpers add explicit filters for clarity, not as the actual
// security boundary.

export async function getBuyerOrders(): Promise<OrderListItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("orders")
    .select("id, total_amount, payment_status, order_status, created_at, order_items(id)")
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []).map((o) => ({
    id: o.id,
    total_amount: o.total_amount,
    payment_status: o.payment_status,
    order_status: o.order_status,
    created_at: o.created_at,
    itemCount: Array.isArray(o.order_items) ? o.order_items.length : 0,
  }));
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, buyer_id, buyer_name, buyer_phone, subtotal, delivery_fee, platform_fee, total_amount, payment_status, order_status, delivery_county, delivery_address, delivery_notes, created_at"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return null;

  const { data: items } = await supabase
    .from("order_items")
    .select("id, product_id, product_name_snapshot, price_at_purchase, quantity, subtotal, farmer_id")
    .eq("order_id", orderId);

  const deliveryMap = await getDeliveryInfoForOrders(supabase, [orderId]);

  return { ...order, items: items ?? [], delivery: deliveryMap.get(orderId) ?? null };
}

export type FarmerOrderLine = {
  orderId: string;
  orderCreatedAt: string;
  orderStatus: string;
  paymentStatus: string;
  buyerName: string;
  productName: string;
  quantity: number;
  subtotal: number;
};

export async function getFarmerOrderLines(farmerId: string): Promise<FarmerOrderLine[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_items")
    .select(
      "product_name_snapshot, quantity, subtotal, orders(id, created_at, order_status, payment_status, buyer_name)"
    )
    .eq("farmer_id", farmerId)
    .order("created_at", { ascending: false });

  return (data ?? [])
    .map((row) => {
      const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
      if (!order) return null;
      return {
        orderId: order.id,
        orderCreatedAt: order.created_at,
        orderStatus: order.order_status,
        paymentStatus: order.payment_status,
        buyerName: order.buyer_name,
        productName: row.product_name_snapshot,
        quantity: row.quantity,
        subtotal: row.subtotal,
      };
    })
    .filter((line): line is FarmerOrderLine => line !== null);
}

export type FarmerOrder = {
  orderId: string;
  orderCreatedAt: string;
  orderStatus: string;
  paymentStatus: string;
  buyerName: string;
  items: { productName: string; quantity: number; subtotal: number }[];
  total: number;
  delivery: OrderDeliveryInfo | null;
};

/**
 * Same underlying rows as getFarmerOrderLines, grouped by order for a
 * per-order action UI. The order_items -> orders join itself
 * (getFarmerOrderLines) is untouched by C6 — delivery info is merged in
 * afterward, batched across every order on the page in one pair of
 * queries via getDeliveryInfoForOrders() rather than one query per order.
 */
export async function getFarmerOrders(farmerId: string): Promise<FarmerOrder[]> {
  const lines = await getFarmerOrderLines(farmerId);
  const byOrder = new Map<string, FarmerOrder>();

  for (const line of lines) {
    const existing = byOrder.get(line.orderId);
    if (existing) {
      existing.items.push({ productName: line.productName, quantity: line.quantity, subtotal: line.subtotal });
      existing.total += line.subtotal;
    } else {
      byOrder.set(line.orderId, {
        orderId: line.orderId,
        orderCreatedAt: line.orderCreatedAt,
        orderStatus: line.orderStatus,
        paymentStatus: line.paymentStatus,
        buyerName: line.buyerName,
        items: [{ productName: line.productName, quantity: line.quantity, subtotal: line.subtotal }],
        total: line.subtotal,
        delivery: null,
      });
    }
  }

  const supabase = await createClient();
  const deliveryMap = await getDeliveryInfoForOrders(supabase, [...byOrder.keys()]);
  for (const order of byOrder.values()) {
    order.delivery = deliveryMap.get(order.orderId) ?? null;
  }

  return [...byOrder.values()];
}

export type AdminOrderListItem = {
  id: string;
  buyer_name: string;
  total_amount: number;
  payment_status: string;
  order_status: string;
  delivery_county: string;
  delivery_address: string;
  created_at: string;
  delivery: OrderDeliveryInfo | null;
};

/**
 * Orders visible to admin. RLS (is_admin()) is the real boundary. Delivery
 * info (Phase D, checkpoint D1) is attached so AdminOrderStatusActions can
 * tell whether a delivery partner has already claimed the delivery
 * (transporterId !== null) before deciding whether to offer the ordinary
 * status buttons or the explicit admin override — reuses
 * getDeliveryInfoForOrders(), the same batched helper getFarmerOrders()
 * already relies on, rather than a new query shape.
 *
 * The filter was originally just `payment_status != 'PENDING'` (the "paid
 * orders" delivery queue this page was first built for). Phase D, D3 needs
 * admin to also be able to see and cancel a PENDING_PAYMENT order where the
 * buyer never attempted payment at all — payment_status still the default
 * 'PENDING' — which the original filter excluded entirely. The .or() below
 * adds that one case back in (any order whose order_status is
 * PENDING_PAYMENT, regardless of payment_status) while leaving every
 * previously-visible row exactly as visible as before: the original
 * condition is still one side of the OR, untouched.
 */
export async function getAdminOrders(): Promise<AdminOrderListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, buyer_name, total_amount, payment_status, order_status, delivery_county, delivery_address, created_at")
    .or("payment_status.neq.PENDING,order_status.eq.PENDING_PAYMENT")
    .order("created_at", { ascending: false });

  const orders = data ?? [];
  const deliveryMap = await getDeliveryInfoForOrders(supabase, orders.map((o) => o.id));

  return orders.map((o) => ({ ...o, delivery: deliveryMap.get(o.id) ?? null }));
}
