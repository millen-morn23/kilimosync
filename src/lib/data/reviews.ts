import { createClient } from "@/lib/supabase/server";

export type ProductReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export async function getReviewsForProduct(productId: string): Promise<{
  reviews: ProductReview[];
  averageRating: number | null;
}> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  const reviews = data ?? [];
  const averageRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : null;

  return { reviews, averageRating };
}

/** order_item_ids the current buyer has already reviewed, for one order. */
export async function getReviewedOrderItemIds(orderId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data: items } = await supabase.from("order_items").select("id").eq("order_id", orderId);
  const itemIds = (items ?? []).map((i) => i.id);
  if (itemIds.length === 0) return new Set();

  const { data: reviews } = await supabase
    .from("reviews")
    .select("order_item_id")
    .in("order_item_id", itemIds);

  return new Set((reviews ?? []).map((r) => r.order_item_id));
}
