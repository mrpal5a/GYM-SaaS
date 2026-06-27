"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/auth/admin-context";
import { onboardGymSchema, updateSubscriptionSchema } from "@/lib/validations/admin";
import { slugify } from "@/lib/validations/auth";

type ActionResult = { ok: false; error: string } | { ok: true };

export async function adminCreateGymAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, error: "Not authorized" };

  const parsed = onboardGymSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { gymName, ownerFullName, email, password, plan, periodEnd } = parsed.data;

  const admin = createAdminClient();
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (userErr || !created.user) {
    return { ok: false, error: userErr?.message ?? "Could not create the owner account" };
  }

  const userId = created.user.id;
  const slug = `${slugify(gymName)}-${userId.slice(0, 6)}`;
  const { error: rpcErr } = await ctx.supabase.rpc("admin_create_gym_with_owner", {
    p_user_id: userId, p_email: email, p_full_name: ownerFullName,
    p_gym_name: gymName, p_slug: slug, p_plan: plan,
    p_period_end: new Date(periodEnd).toISOString(),
  });
  if (rpcErr) {
    // Roll back the orphaned auth user so the email can be retried.
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: rpcErr.message };
  }

  revalidatePath("/admin");
  redirect("/admin");
}

export async function adminUpdateSubscriptionAction(
  gymId: string, _prev: unknown, formData: FormData,
): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, error: "Not authorized" };

  const parsed = updateSubscriptionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { plan, status, periodEnd } = parsed.data;

  const { error } = await ctx.supabase
    .from("subscriptions")
    .update({ plan, status, current_period_end: new Date(periodEnd).toISOString() })
    .eq("gym_id", gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/gyms/${gymId}`);
  revalidatePath("/admin");
  return { ok: true };
}
