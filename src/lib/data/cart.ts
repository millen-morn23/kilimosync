import { createClient } from "@/lib/supabase/server";

export type CartLine = {
  cartItemId: string;
  productId: string;
  name: string;
  slug: string;
  price: number;
  priceUnit: string;
  quantity: number;
  quantityAvailable: number;
  minOrderQuantity: number;
  image: string | null;
  farmName: string;
  lineTotal: number;
  isActive: boolean;
};

export type CartSummary = {
  lines: CartLine[];
  subtotal: number;
};

export async function getCart(): Promise<CartSummary> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { lines: [], subtotal: 0 };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { lines: [], subtotal: 0 };

  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("buyer_id", user.id)
    .maybeSingle();
  if (!cart) return { lines: [], subtotal: 0 };

  const { data: items } = await supabase
    .from("cart_items")
    .select(
      "id, quantity, products(id, name, slug, price, price_unit, quantity_available, min_order_quantity, images, status, farmer_profiles(farm_name))"
    )
    .eq("cart_id", cart.id);

  if (!items) return { lines: [], subtotal: 0 };

  const lines: CartLine[] = items
    .map((item) => {
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      if (!product) return null;
      const farmer = Array.isArray(product.farmer_profiles)
        ? product.farmer_profiles[0]
        : product.farmer_profiles;

      return {
        cartItemId: item.id,
        productId: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        priceUnit: product.price_unit,
        quantity: item.quantity,
        quantityAvailable: product.quantity_available,
        minOrderQuantity: product.min_order_quantity,
        image: product.images?.[0] ?? null,
        farmName: farmer?.farm_name ?? "KilimoSync farmer",
        lineTotal: Math.round(product.price * item.quantity * 100) / 100,
        isActive: product.status === "active",
      };
    })
    .filter((line): line is CartLine => line !== null);

  const subtotal = Math.round(lines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100;

  return { lines, subtotal };
}
