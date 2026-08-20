import { z } from "zod";

import { kenyanPhoneSchema } from "@/lib/validation/auth";

export const checkoutSchema = z.object({
  buyerName: z.string().trim().min(2, "Name is too short").max(120),
  buyerPhone: kenyanPhoneSchema,
  deliveryCounty: z.string().trim().min(2, "Select a county"),
  deliveryAddress: z.string().trim().min(5, "Add a delivery address"),
  deliveryNotes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
