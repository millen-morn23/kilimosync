"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { success: true };
type BuyerAuth =
  | { ok: false; error: string }
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; buyerId: string };

async function requireBuyer(): Promise<BuyerAuth> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "buyer") {
    return { ok: false, error: "Only buyer accounts have a cart." };
  }
  return { ok: true, supabase, buyerId: user.id };
}

async function getOrCreateCartId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  buyerId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("carts")
    .select("id")
    .eq("buyer_id", buyerId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created } = await supabase
    .from("carts")
    .insert({ buyer_id: buyerId })
    .select("id")
    .single();
  return created!.id;
}

export async function addToCart(productId: string, quantity: number): Promise<ActionResult> {
  const auth = await requireBuyer();
  if (!auth.ok) return { error: auth.error };
  const { supabase, buyerId } = auth;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: "Enter a valid quantity." };
  }

  const { data: product } = await supabase
    .from("products")
    .select("quantity_available, min_order_quantity, status, farmer_id")
    .eq("id", productId)
    .maybeSingle();

  if (!product || product.status !== "active") {
    return { error: "This product is no longer available." };
  }
  if (quantity < product.min_order_quantity) {
    return { error: `Minimum order is ${product.min_order_quantity}.` };
  }
  if (quantity > product.quantity_available) {
    return { error: `Only ${product.quantity_available} available.` };
  }

  const cartId = await getOrCreateCartId(supabase, buyerId);

  // Early, friendly warning only — one order = one farmer is actually
  // enforced server-side at checkout (createOrder()) and, beneath that,
  // by a database trigger on order_items. A cart is mutable, transient
  // state, so this check can't be the real boundary; it just catches the
  // common case before the buyer gets to checkout.
  const { data: cartFarmerRows } = await supabase
    .from("cart_items")
    .select("products(farmer_id)")
    .eq("cart_id", cartId);
  const otherFarmerId = (cartFarmerRows ?? [])
    .map((row) => (Array.isArray(row.products) ? row.products[0] : row.products)?.farmer_id)
    .find((existingFarmerId) => existingFarmerId && existingFarmerId !== product.farmer_id);
  if (otherFarmerId) {
    return {
      error:
        "Your cart already has produce from a different farmer. Clear your cart or complete that order first before adding produce from another farm.",
    };
  }

  const { data: existingItem } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cartId)
    .eq("product_id", productId)
    .maybeSingle();

  if (existingItem) {
    const newQuantity = existingItem.quantity + quantity;
    if (newQuantity > product.quantity_available) {
      return { error: `Only ${product.quantity_available} available — you already have ${existingItem.quantity} in your cart.` };
    }
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: newQuantity })
      .eq("id", existingItem.id);
    if (error) return { error: "Could not update your cart." };
  } else {
    const { error } = await supabase
      .from("cart_items")
      .insert({ cart_id: cartId, product_id: productId, quantity });
    if (error) return { error: "Could not add to your cart." };
  }

  revalidatePath("/cart");
  return { success: true };
}

export async function updateCartItemQuantity(
  cartItemId: string,
  quantity: number
): Promise<ActionResult> {
  const auth = await requireBuyer();
  if (!auth.ok) return { error: auth.error };
  const { supabase } = auth;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: "Enter a valid quantity." };
  }

  const { data: item } = await supabase
    .from("cart_items")
    .select("product_id")
    .eq("id", cartItemId)
    .maybeSingle();
  if (!item) return { error: "Item not found in your cart." };

  const { data: product } = await supabase
    .from("products")
    .select("quantity_available, min_order_quantity")
    .eq("id", item.product_id)
    .maybeSingle();
  if (!product) return { error: "This product is no longer available." };

  if (quantity < product.min_order_quantity) {
    return { error: `Minimum order is ${product.min_order_quantity}.` };
  }
  if (quantity > product.quantity_available) {
    return { error: `Only ${product.quantity_available} available.` };
  }

  const { error } = await supabase
    .from("cart_items")
    .update({ quantity })
    .eq("id", cartItemId);
  if (error) return { error: "Could not update your cart." };

  revalidatePath("/cart");
  return { success: true };
}

export async function removeCartItem(cartItemId: string): Promise<ActionResult> {
  const auth = await requireBuyer();
  if (!auth.ok) return { error: auth.error };
  const { supabase } = auth;

  const { error } = await supabase.from("cart_items").delete().eq("id", cartItemId);
  if (error) return { error: "Could not remove item." };

  revalidatePath("/cart");
  return { success: true };
}
