import { z } from "zod";

const plan = z.enum(["starter", "professional", "enterprise"]);
const status = z.enum(["trialing", "active", "past_due", "canceled"]);

export const onboardGymSchema = z.object({
  gymName: z.string().min(2, "Gym name too short").max(120),
  ownerFullName: z.string().min(1, "Required").max(120),
  email: z.email(),
  password: z.string().min(8, "Min 8 characters").max(72),
  plan,
  periodEnd: z.string().min(1, "Pick an expiry date"),
});

export const updateSubscriptionSchema = z.object({
  plan,
  status,
  periodEnd: z.string().min(1, "Pick an expiry date"),
});

export type OnboardGymInput = z.infer<typeof onboardGymSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
