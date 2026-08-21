"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createReviewSchema, type CreateReviewInput } from "@/lib/validation/reviews";

type ActionResult = { error: string } | { success: true };

/**
 * product_id and farmer_id are re-derived from the order_item row here,
 * never trusted from the client — otherwise a crafted request could
 * attach a review to an unrelated product. RLS
 * (reviews_insert_own_completed_order, 0002_rls.sql) is still the real
 * boundary: it re-checks server-side that order_item_id belongs to the
 * caller's own COMPLETED order and enforces the one-review-per-item
 * unique constraint.
 */
export async function createReview(input: CreateReviewInput): Promise<ActionResult> {
  const parsed = createReviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: orderItem } = await supabase
    .from("order_items")
    .select("product_id, farmer_id")
    .eq("id", parsed.data.orderItemId)
    .maybeSingle();
  if (!orderItem) return { error: "Order item not found." };

  const { error } = await supabase.from("reviews").insert({
    order_item_id: parsed.data.orderItemId,
    buyer_id: user.id,
    farmer_id: orderItem.farmer_id,
    product_id: orderItem.product_id,
    rating: parsed.data.rating,
    comment: parsed.data.comment || null,
  });

  if (error) {
    if (error.code === "23505") return { error: "You already reviewed this item." };
    return { error: "Could not submit your review. It may only be left on a completed order." };
  }

  revalidatePath("/orders");
  return { success: true };
}
