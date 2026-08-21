import { z } from "zod";

export const mpesaPhoneSchema = z
  .string()
  .trim()
  .min(9, "Enter a valid M-PESA phone number")
  .refine((value) => /^(?:\+?254|0)?[17]\d{8}$/.test(value.replace(/\s/g, "")), {
    message: "Enter a valid Safaricom number, e.g. 0712 345 678",
  });
