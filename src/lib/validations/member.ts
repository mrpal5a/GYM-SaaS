import { z } from "zod";

// FormData sends every field as a string; "" means "not provided". This turns
// blank optional fields into undefined before validation/coercion.
const optionalText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().max(2000).optional(),
);

const optionalEmail = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.email("Invalid email").optional(),
);

const optionalNumber = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.coerce.number().positive("Must be positive").max(1000).optional(),
);

const optionalDate = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date").optional(),
);

export const memberSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(120),
  email: optionalEmail,
  phone: optionalText,
  // Alternate / emergency contact — optional for manual entry so the owner is never
  // blocked adding a walk-in who didn't provide one.
  emergency_phone: optionalText,
  gender: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.enum(["male", "female", "other"]).optional(),
  ),
  date_of_birth: optionalDate,
  height_cm: optionalNumber,
  weight_kg: optionalNumber,
  address: optionalText,
  notes: optionalText,
  joined_at: optionalDate,
});

export type MemberInput = z.infer<typeof memberSchema>;
