"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/auth/admin-context";
import { onboardGymSchema, updateSubscriptionSchema } from "@/lib/validations/admin";
import { slugify } from "@/lib/validations/auth";
import { sendWeeklyGymBackups, type BackupSummary } from "@/lib/admin/weekly-backup";
import { buildGymWelcomeEmail } from "@/lib/admin/gym-welcome-content";
import { sendPlatformEmail } from "@/lib/email/resend";
import { siteUrl } from "@/lib/site-url";
import { formatDate } from "@/lib/members/metrics";

type ActionResult = { ok: false; error: string } | { ok: true };

export type BackupActionResult =
  | { ok: true; summary: BackupSummary }
  | { ok: false; error: string };

/**
 * Super-admin "email backups now": run the same weekly job on demand, across all
 * gyms. Uses the service-role client (the caller is verified as super_admin).
 */
export async function sendWeeklyBackupsAction(): Promise<BackupActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, error: "Not authorized" };
  // Cap a single click so the action stays snappy even with many gyms; the
  // Monday cron (uncapped, long maxDuration) handles the full set, and repeated
  // clicks or the scheduled run cover any remainder (idempotent this week).
  const summary = await sendWeeklyGymBackups(createAdminClient(), { limit: 25 });
  return { ok: true, summary };
}

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

  // Welcome the new gym owner (best-effort, in the background) — congrats + a tour
  // of the features + their plan and next renewal. Never blocks onboarding.
  const welcome = buildGymWelcomeEmail({
    ownerName: ownerFullName,
    gymName,
    plan,
    renewalDate: formatDate(new Date(periodEnd).toISOString().slice(0, 10)),
    loginUrl: siteUrl(),
  });
  after(async () => {
    try {
      await sendPlatformEmail({ to: email, subject: welcome.subject, text: welcome.text, html: welcome.html });
    } catch {
      // Best-effort — onboarding already succeeded.
    }
  });

  revalidatePath("/admin");
  redirect("/admin");
}

/**
 * Super-admin pause/resume of a gym's service. Sets or clears `subscriptions.
 * paused_at`; the `(app)` layout redirects a paused gym's owner + staff to
 * `/suspended`. Manual by design — the admin decides when to pause after their
 * own grace-period follow-ups.
 */
export async function adminSetGymPausedAction(
  gymId: string,
  paused: boolean,
): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, error: "Not authorized" };
  if (!gymId) return { ok: false, error: "Missing gym." };

  const { error } = await ctx.supabase
    .from("subscriptions")
    .update({ paused_at: paused ? new Date().toISOString() : null })
    .eq("gym_id", gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath(`/admin/gyms/${gymId}`);
  return { ok: true };
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
