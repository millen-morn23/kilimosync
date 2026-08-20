import { z } from "zod";

export const createFarmerProfileSchema = z.object({
  farmName: z.string().trim().min(2, "Farm name is too short").max(120),
  county: z.string().trim().min(2, "Select your county"),
  subcounty: z.string().trim().max(120).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  farmDescription: z.string().trim().max(1000).optional().or(z.literal("")),
  mainCrops: z.string().trim().min(1, "List at least one crop"),
});

export type CreateFarmerProfileInput = z.infer<typeof createFarmerProfileSchema>;

export function parseMainCrops(value: string): string[] {
  return value
    .split(",")
    .map((crop) => crop.trim())
    .filter(Boolean);
}
