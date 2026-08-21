import { createClient } from "@/lib/supabase/server";

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

  return { ...order, items: items ?? [] };
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
};

/** Same underlying rows as getFarmerOrderLines, grouped by order for a per-order action UI. */
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
      });
    }
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
};

/** Orders that have been paid for — the admin delivery queue. RLS (is_admin()) is the real boundary. */
export async function getAdminOrders(): Promise<AdminOrderListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, buyer_name, total_amount, payment_status, order_status, delivery_county, delivery_address, created_at")
    .neq("payment_status", "PENDING")
    .order("created_at", { ascending: false });

  return data ?? [];
}
