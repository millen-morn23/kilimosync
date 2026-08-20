import { z } from "zod";

export const PRICE_UNITS = ["kg", "g", "bag", "crate", "bunch", "piece", "litre", "tray"] as const;
export const QUANTITY_UNITS = PRICE_UNITS;

export const createProductSchema = z
  .object({
    name: z.string().trim().min(2, "Name is too short").max(120),
    categoryId: z.string().uuid("Select a category").optional().or(z.literal("")),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    price: z.number().positive("Price must be greater than 0").max(1_000_000),
    priceUnit: z.enum(PRICE_UNITS),
    quantityAvailable: z.number().nonnegative("Quantity can't be negative").max(1_000_000),
    quantityUnit: z.enum(QUANTITY_UNITS),
    minOrderQuantity: z.number().positive("Minimum order must be greater than 0").max(1_000_000),
    harvestDate: z.string().trim().optional().or(z.literal("")),
    images: z.array(z.string().url()).max(6, "Up to 6 images"),
  })
  .refine((data) => data.quantityAvailable === 0 || data.minOrderQuantity <= data.quantityAvailable, {
    message: "Minimum order can't exceed available quantity",
    path: ["minOrderQuantity"],
  });

export type CreateProductInput = z.infer<typeof createProductSchema>;

export function slugifyProductName(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "product"
  );
}
