import { z } from "zod";

export const paymentSchema = z.object({
  member_id: z.uuid("Select a member"),
  amount: z.coerce.number().positive("Amount must be greater than 0").max(1_000_000),
  method: z.enum(["cash", "card", "upi", "bank_transfer", "other"]),
  note: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(500).optional(),
  ),
  paid_at: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date").optional(),
  ),
});

export const assignMembershipSchema = z.object({
  member_id: z.uuid(),
  plan_id: z.uuid("Select a plan"),
  start_date: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date").optional(),
  ),
  // optional: also record a payment for the plan price in the same step
  record_payment: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
export type AssignMembershipInput = z.infer<typeof assignMembershipSchema>;
