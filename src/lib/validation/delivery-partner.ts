import { z } from "zod";

export const VEHICLE_TYPES = ["bicycle", "motorbike", "car", "van", "on_foot"] as const;

const NON_MOTORIZED = new Set(["bicycle", "on_foot"]);

export const createDeliveryPartnerProfileSchema = z
  .object({
    vehicleType: z.enum(VEHICLE_TYPES),
    vehicleRegistration: z.string().trim().max(20).optional().or(z.literal("")),
    operatingCounty: z.string().trim().min(2, "Select your operating county"),
  })
  .refine(
    (data) => NON_MOTORIZED.has(data.vehicleType) || Boolean(data.vehicleRegistration),
    {
      message: "Vehicle registration is required for a motorbike, car, or van",
      path: ["vehicleRegistration"],
    }
  );

export type CreateDeliveryPartnerProfileInput = z.infer<typeof createDeliveryPartnerProfileSchema>;
