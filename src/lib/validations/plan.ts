import { z } from "zod";

export const planSchema = z.object({
  name: z.string().trim().min(1, "Plan name is required").max(120),
  description: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(500).optional(),
  ),
  price: z.coerce.number().min(0, "Price cannot be negative").max(1_000_000),
  duration_days: z.coerce
    .number()
    .int("Whole days only")
    .positive("Duration must be at least 1 day")
    .max(3650),
});

export type PlanInput = z.infer<typeof planSchema>;
