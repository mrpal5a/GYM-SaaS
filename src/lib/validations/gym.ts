import { z } from "zod";

export const gymBrandingSchema = z.object({
  name: z.string().trim().min(1, "Gym name is required").max(120),
});

export type GymBrandingInput = z.infer<typeof gymBrandingSchema>;
