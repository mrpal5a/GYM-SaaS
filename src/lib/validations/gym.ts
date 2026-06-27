import { z } from "zod";

export const gymBrandingSchema = z.object({
  name: z.string().trim().min(1, "Gym name is required").max(120),
  address: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(300).optional(),
  ),
});

export type GymBrandingInput = z.infer<typeof gymBrandingSchema>;

// The joining-form rules list. Blank entries are dropped (the editor can leave
// empty inputs); each remaining rule is trimmed and capped, max 30 rules.
export const gymRulesSchema = z.preprocess(
  (v) =>
    Array.isArray(v)
      ? v.map((s) => (typeof s === "string" ? s.trim() : "")).filter((s) => s.length > 0)
      : v,
  z.array(z.string().min(1).max(200)).max(30, "At most 30 rules"),
);

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
