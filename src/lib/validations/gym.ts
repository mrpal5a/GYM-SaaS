import { z } from "zod";

export const gymBrandingSchema = z.object({
  name: z.string().trim().min(1, "Gym name is required").max(120),
});

export type GymBrandingInput = z.infer<typeof gymBrandingSchema>;

// UPI details shown on the public join form. Both optional — leaving UPI ID blank
// makes the join form Cash-only.
export const onboardingSettingsSchema = z.object({
  upi_id: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .trim()
      .regex(/^[\w.-]+@[\w.-]+$/, "Enter a valid UPI ID, e.g. yourgym@okhdfc")
      .max(100)
      .optional(),
  ),
  upi_payee_name: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(120).optional(),
  ),
});

export type OnboardingSettingsInput = z.infer<typeof onboardingSettingsSchema>;
