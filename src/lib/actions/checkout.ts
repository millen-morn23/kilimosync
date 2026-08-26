"use server";

import { createClient } from "@/lib/supabase/server";
import { checkoutSchema, type CheckoutInput } from "@/lib/validation/checkout";
import { FLAT_DELIVERY_FEE_KES } from "@/lib/constants";

type ActionResult = { error: string } | { success: true; orderId: string };

/**
 * Creates an order from the buyer's current cart. Every price and
 * availability check is re-derived from the database here — nothing from
 * the client is trusted for money math (see CLAUDE.md rule 3).
 *
 * One order = one farmer (see supabase/migrations/0015_single_farmer_orders.sql):
 * a cart spanning multiple farmers is rejected here rather than silently
 * split. orders.farmer_id is the authoritative farmer relationship — set
 * once, here, from the validated single-farmer cart — and every
 * order_items row is checked against it by a database trigger, not the
 * other way around.
 *
 * This does NOT process payment and does NOT deduct inventory. M-PESA
 * (Phase 3) owns both of those, triggered only by a verified payment
 * callback — see docs/M-PESA.md. The order is created PENDING_PAYMENT and
 * stays that way until that phase exists.
 */
export async function createOrder(input: CheckoutInput): Promise<ActionResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("buyer_id", user.id)
    .maybeSingle();
  if (!cart) return { error: "Your cart is empty." };

  const { data: items } = await supabase
    .from("cart_items")
    .select("id, quantity, products(id, name, price, status, quantity_available, farmer_id)")
    .eq("cart_id", cart.id);

  if (!items || items.length === 0) {
    return { error: "Your cart is empty." };
  }

  type LineCheck = {
    productId: string;
    farmerId: string;
    name: string;
    price: number;
    quantity: number;
  };
  const lines: LineCheck[] = [];

  for (const item of items) {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    if (!product || product.status !== "active") {
      return { error: `"${product?.name ?? "An item"}" is no longer available. Please update your cart.` };
    }
    if (item.quantity > product.quantity_available) {
      return {
        error: `Only ${product.quantity_available} of "${product.name}" is available. Please update your cart.`,
      };
    }
    lines.push({
      productId: product.id,
      farmerId: product.farmer_id,
      name: product.name,
      price: product.price,
      quantity: item.quantity,
    });
  }

  const farmerIds = new Set(lines.map((l) => l.farmerId));
  if (farmerIds.size > 1) {
    return {
      error:
        "Your cart has produce from more than one farmer. Please check out each farm's items separately.",
    };
  }
  const farmerId = lines[0].farmerId;

  const subtotal = round2(lines.reduce((sum, l) => sum + l.price * l.quantity, 0));

  const { data: settings } = await supabase
    .from("platform_settings")
    .select("platform_fee_percent")
    .eq("id", 1)
    .maybeSingle();
  const feePercent = settings?.platform_fee_percent ?? 5;
  const platformFee = round2(subtotal * (feePercent / 100));
  const deliveryFee = FLAT_DELIVERY_FEE_KES;
  const totalAmount = round2(subtotal + platformFee + deliveryFee);

  const { deliveryCounty, deliveryAddress, deliveryNotes, buyerName, buyerPhone } = parsed.data;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      buyer_id: user.id,
      farmer_id: farmerId,
      subtotal,
      delivery_fee: deliveryFee,
      platform_fee: platformFee,
      total_amount: totalAmount,
      payment_status: "PENDING",
      order_status: "PENDING_PAYMENT",
      delivery_county: deliveryCounty,
      delivery_address: deliveryAddress,
      delivery_notes: deliveryNotes || null,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return { error: "Could not create your order. Please try again." };
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    lines.map((line) => ({
      order_id: order.id,
      product_id: line.productId,
      farmer_id: line.farmerId,
      product_name_snapshot: line.name,
      price_at_purchase: line.price,
      quantity: line.quantity,
      subtotal: round2(line.price * line.quantity),
    }))
  );

  if (itemsError) {
    return { error: "Could not save your order items. Please try again." };
  }

  await supabase.from("cart_items").delete().eq("cart_id", cart.id);

  return { success: true, orderId: order.id };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
