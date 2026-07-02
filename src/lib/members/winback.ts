import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendReminderEmail } from "@/lib/email/resend";
import { buildJoinUrl } from "@/lib/gym/join-link";
import { buildWinbackEmail, WINBACK_MAX_MONTHS } from "@/lib/members/winback-content";

export interface WinbackSummary {
  /** Archived members with an email inside the win-back window that were examined. */
  scanned: number;
  /** Win-back emails successfully sent this run. */
  sent: number;
  /** Skipped because this member was already emailed for the current month. */
  skipped: number;
  /** Sends that failed (e.g. Resend not configured, bad address). */
  failed: number;
  /** True when every failure was "email not configured". */
  emailNotConfigured: boolean;
  errors: string[];
}

type ArchivedRow = {
  id: string;
  gym_id: string;
  full_name: string;
  email: string | null;
  archived_at: string | null;
};

/**
 * Email a monthly win-back nudge to members who left the gym (archived), inviting
 * them to rejoin via the gym's public join link. Sent once per member per calendar
 * month for up to {@link WINBACK_MAX_MONTHS} months after archiving — the
 * winback_emails log makes it idempotent, so the monthly cron is safe to re-run.
 *
 * Must be called with a service-role client (RLS bypassed) so it can see across
 * gyms. Pass `gymId` to scope to a single gym (owner-triggered "send now").
 */
export async function sendWinbackEmails(
  admin: SupabaseClient,
  opts: { gymId?: string; now?: Date } = {},
): Promise<WinbackSummary> {
  const summary: WinbackSummary = {
    scanned: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    emailNotConfigured: false,
    errors: [],
  };

  const now = new Date(opts.now ?? new Date());
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  // Only members archived within the last WINBACK_MAX_MONTHS months still get nudged.
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - WINBACK_MAX_MONTHS);

  let query = admin
    .from("members")
    .select("id, gym_id, full_name, email, archived_at")
    .not("archived_at", "is", null)
    .gte("archived_at", cutoff.toISOString())
    .not("email", "is", null);
  if (opts.gymId) query = query.eq("gym_id", opts.gymId);

  const { data, error } = await query;
  if (error) {
    summary.errors.push(error.message);
    return summary;
  }
  const rows = (data ?? []) as ArchivedRow[];
  summary.scanned = rows.length;
  if (rows.length === 0) return summary;

  // Skip members already *successfully* emailed this month. Failed rows aren't
  // skipped, so a transient send failure retries on the next run (the unique
  // (member_id, period) row is upserted from failed → sent on success).
  const { data: existing } = await admin
    .from("winback_emails")
    .select("member_id")
    .eq("period", period)
    .eq("status", "sent")
    .in(
      "member_id",
      rows.map((r) => r.id),
    );
  const alreadySent = new Set((existing ?? []).map((e) => e.member_id as string));

  // Gym name + join token (for the rejoin link) per gym.
  const gymIds = [...new Set(rows.map((r) => r.gym_id))];
  const { data: gyms } = await admin.from("gyms").select("id, name, join_token").in("id", gymIds);
  const gymInfo = new Map(
    (gyms ?? []).map((g) => [g.id as string, { name: g.name as string, token: g.join_token as string }]),
  );

  for (const row of rows) {
    if (!row.email) continue;
    if (alreadySent.has(row.id)) {
      summary.skipped++;
      continue;
    }
    const info = gymInfo.get(row.gym_id);
    const gymName = info?.name ?? "your gym";
    const joinUrl = info?.token ? buildJoinUrl(info.token) : "";
    const { subject, text, html } = buildWinbackEmail({
      memberName: row.full_name,
      gymName,
      joinUrl,
    });
    const result = await sendReminderEmail({ to: row.email, gymName, subject, text, html });

    await admin.from("winback_emails").upsert(
      {
        gym_id: row.gym_id,
        member_id: row.id,
        period,
        status: result.ok ? "sent" : "failed",
        error: result.ok ? null : result.error,
        sent_at: new Date().toISOString(),
      },
      { onConflict: "member_id,period" },
    );

    if (result.ok) {
      summary.sent++;
    } else {
      summary.failed++;
      if (!summary.errors.includes(result.error)) summary.errors.push(result.error);
    }
  }

  summary.emailNotConfigured =
    summary.failed > 0 && summary.errors.every((e) => e.includes("isn't configured"));

  return summary;
}
