import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendReminderEmail } from "@/lib/email/resend";
import {
  REMINDER_OFFSETS,
  buildReminderEmail,
  dayDiff,
  matchOffset,
} from "@/lib/members/reminder-content";

export interface ReminderSummary {
  /** Members inside the reminder window that were examined. */
  scanned: number;
  /** Reminder emails successfully sent. */
  sent: number;
  /** Candidates skipped because that reminder was already sent. */
  skipped: number;
  /** Sends that failed (e.g. Resend not configured, bad address). */
  failed: number;
  /** True when every failure was "email not configured". */
  emailNotConfigured: boolean;
  errors: string[];
}

type MemberRow = {
  id: string;
  gym_id: string;
  full_name: string;
  email: string | null;
  subscription_id: string | null;
  plan_name: string | null;
  end_date: string | null;
};

/**
 * Scan memberships nearing (or just past) expiry and email each member a renewal
 * reminder, once per {@link REMINDER_OFFSETS} offset per subscription. Idempotent:
 * already-sent reminders are recorded in `renewal_reminders` and skipped, so the
 * job is safe to run daily (and repeatedly within a day).
 *
 * Must be called with a service-role client (RLS bypassed) so it can see across
 * gyms. Pass `gymId` to scope to a single gym (owner-triggered "send now").
 */
export async function sendRenewalReminders(
  admin: SupabaseClient,
  opts: { gymId?: string; now?: Date } = {},
): Promise<ReminderSummary> {
  const summary: ReminderSummary = {
    scanned: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    emailNotConfigured: false,
    errors: [],
  };

  const today = new Date(opts.now ?? new Date());
  today.setHours(0, 0, 0, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const shift = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return iso(d);
  };
  const windowStart = shift(Math.min(...REMINDER_OFFSETS));
  const windowEnd = shift(Math.max(...REMINDER_OFFSETS));

  // Active members with an email and a subscription ending inside the window.
  let query = admin
    .from("member_with_status")
    .select("id, gym_id, full_name, email, subscription_id, plan_name, end_date")
    .eq("is_active", true)
    .not("email", "is", null)
    .not("subscription_id", "is", null)
    .gte("end_date", windowStart)
    .lte("end_date", windowEnd);
  if (opts.gymId) query = query.eq("gym_id", opts.gymId);

  const { data, error } = await query;
  if (error) {
    summary.errors.push(error.message);
    return summary;
  }
  const rows = (data ?? []) as MemberRow[];
  summary.scanned = rows.length;

  // Keep only rows landing exactly on a reminder offset.
  const candidates = rows.flatMap((r) => {
    if (!r.end_date || !r.subscription_id || !r.email) return [];
    const offset = matchOffset(dayDiff(r.end_date, today));
    if (offset === null) return [];
    return [{ row: r, offset, daysLeft: dayDiff(r.end_date, today) }];
  });
  if (candidates.length === 0) return summary;

  // Dedup against reminders already sent for these subscriptions.
  const subIds = [...new Set(candidates.map((c) => c.row.subscription_id!))];
  const { data: existing } = await admin
    .from("renewal_reminders")
    .select("subscription_id, reminder_type")
    .in("subscription_id", subIds)
    .eq("status", "sent");
  const alreadySent = new Set(
    (existing ?? []).map((e) => `${e.subscription_id}:${e.reminder_type}`),
  );

  // Gym names for the email "from" + body.
  const gymIds = [...new Set(candidates.map((c) => c.row.gym_id))];
  const { data: gyms } = await admin.from("gyms").select("id, name").in("id", gymIds);
  const gymName = new Map((gyms ?? []).map((g) => [g.id as string, g.name as string]));

  for (const { row, offset, daysLeft } of candidates) {
    if (alreadySent.has(`${row.subscription_id}:${offset}`)) {
      summary.skipped++;
      continue;
    }
    const name = gymName.get(row.gym_id) ?? "your gym";
    const { subject, text, html } = buildReminderEmail({
      memberName: row.full_name,
      gymName: name,
      planName: row.plan_name,
      endDate: row.end_date,
      daysLeft,
    });
    const result = await sendReminderEmail({ to: row.email!, gymName: name, subject, text, html });

    await admin.from("renewal_reminders").upsert(
      {
        gym_id: row.gym_id,
        member_id: row.id,
        subscription_id: row.subscription_id,
        reminder_type: String(offset),
        channel: "email",
        status: result.ok ? "sent" : "failed",
        error: result.ok ? null : result.error,
        end_date: row.end_date,
        sent_at: new Date().toISOString(),
      },
      { onConflict: "subscription_id,reminder_type" },
    );

    if (result.ok) {
      summary.sent++;
    } else {
      summary.failed++;
      if (!summary.errors.includes(result.error)) summary.errors.push(result.error);
    }
  }

  // Flag the common "no key yet" case so callers can show a helpful message.
  summary.emailNotConfigured =
    summary.failed > 0 && summary.errors.every((e) => e.includes("isn't configured"));

  return summary;
}
