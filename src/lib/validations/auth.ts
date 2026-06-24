import { z } from "zod";

export const signupSchema = z.object({
  fullName: z.string().min(1, "Required").max(120),
  gymName: z.string().min(2, "Gym name too short").max(120),
  email: z.email(),
  password: z.string().min(8, "Min 8 characters").max(72),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Required"),
});

export const inviteSchema = z.object({
  email: z.email(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
