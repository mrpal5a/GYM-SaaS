"use server";
import { revalidatePath } from "next/cache";
import { getGymContext } from "@/lib/auth/context";
import { canManageGym } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendRenewalReminders, type ReminderSummary } from "@/lib/members/reminders";

export type SendRemindersResult =
  | { ok: true; summary: ReminderSummary }
  | { ok: false; error: string };

/**
 * Owner-triggered "send reminders now" for the caller's gym — the same engine the
 * daily cron runs, scoped to this gym. Idempotent, so clicking twice won't double
 * send. Uses the service-role client (the gym is pinned from the verified JWT).
 */
export async function sendRenewalRemindersAction(): Promise<SendRemindersResult> {
  const ctx = await getGymContext();
  if (!ctx || !canManageGym(ctx.role)) {
    return { ok: false, error: "Not authorized." };
  }

  const summary = await sendRenewalReminders(createAdminClient(), { gymId: ctx.gymId });
  revalidatePath("/renewals");
  return { ok: true, summary };
}
