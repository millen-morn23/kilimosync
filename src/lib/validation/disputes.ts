import { z } from "zod";

export const openDisputeSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10, "Please add a bit more detail").max(2000),
});

export type OpenDisputeInput = z.infer<typeof openDisputeSchema>;
