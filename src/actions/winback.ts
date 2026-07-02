"use server";
import { getGymContext } from "@/lib/auth/context";
import { canManageGym } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWinbackEmails, type WinbackSummary } from "@/lib/members/winback";

export type SendWinbackResult =
  | { ok: true; summary: WinbackSummary }
  | { ok: false; error: string };

/**
 * Owner-triggered "send win-back emails now" for the caller's gym — the same engine
 * the monthly cron runs, scoped to this gym. Idempotent (once per member per month),
 * so clicking twice won't double send. Uses the service-role client (the gym is
 * pinned from the verified JWT).
 */
export async function sendWinbackEmailsAction(): Promise<SendWinbackResult> {
  const ctx = await getGymContext();
  if (!ctx || !canManageGym(ctx.role)) {
    return { ok: false, error: "Not authorized." };
  }

  const summary = await sendWinbackEmails(createAdminClient(), { gymId: ctx.gymId });
  return { ok: true, summary };
}
