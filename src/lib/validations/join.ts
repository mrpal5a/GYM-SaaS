import { z } from "zod";

// Same FormData handling as member.ts: "" (a blank optional field) -> undefined.
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

// Fields a prospect fills on the public join form. Name + phone are required (the
// gym needs to reach them); plan + payment method are required to process a join.
// Photo and UPI screenshot are Files, validated in the action (not here).
export const joinRequestSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().trim().min(5, "Phone number is required").max(20),
  email: optionalEmail,
  gender: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.enum(["male", "female", "other"]).optional(),
  ),
  date_of_birth: optionalDate,
  height_cm: optionalNumber,
  weight_kg: optionalNumber,
  address: optionalText,
  notes: optionalText,
  plan_id: z.uuid("Please select a plan"),
  // Optional Personal Trainer add-on. Blank ("") -> undefined so it's truly optional.
  pt_plan_id: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.uuid().optional(),
  ),
  payment_method: z.enum(["cash", "upi"]),
});

export type JoinRequestInput = z.infer<typeof joinRequestSchema>;
