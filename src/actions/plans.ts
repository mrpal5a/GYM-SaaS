"use server";
import { revalidatePath } from "next/cache";
import { getGymContext } from "@/lib/auth/context";
import { planSchema } from "@/lib/validations/plan";

export type ActionResult = { ok: false; error: string } | { ok: true };

export async function createPlanAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getGymContext();
  if (!ctx) return { ok: false, error: "Not authorized" };

  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { error } = await ctx.supabase
    .from("membership_plans")
    .insert({ gym_id: ctx.gymId, ...parsed.data });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/plans");
  return { ok: true };
}

export async function setPlanActiveAction(formData: FormData): Promise<void> {
  const ctx = await getGymContext();
  if (!ctx) return;
  const planId = String(formData.get("planId") ?? "");
  const next = String(formData.get("isActive") ?? "") === "true";
  if (!planId) return;

  await ctx.supabase
    .from("membership_plans")
    .update({ is_active: next })
    .eq("id", planId)
    .eq("gym_id", ctx.gymId);
  revalidatePath("/plans");
}

export async function deletePlanAction(formData: FormData): Promise<void> {
  const ctx = await getGymContext();
  if (!ctx) return;
  const planId = String(formData.get("planId") ?? "");
  if (!planId) return;

  await ctx.supabase
    .from("membership_plans")
    .delete()
    .eq("id", planId)
    .eq("gym_id", ctx.gymId);
  revalidatePath("/plans");
}
