import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildGymWorkbook } from "@/lib/admin/export-workbook";
import { loadGymExportData } from "@/lib/admin/gym-export";
import { buildBackupEmail, weekStartOf } from "@/lib/admin/backup-content";
import { sendBackupEmail } from "@/lib/email/resend";
import { formatDate } from "@/lib/members/metrics";

export interface BackupSummary {
  /** Gyms processed this run (excludes ones already done this week). */
  processed: number;
  /** Backup emails successfully sent this run. */
  sent: number;
  /** Gyms skipped this run (no owner email, or no data). */
  skipped: number;
  /** Sends that failed this run. */
  failed: number;
  /** Gyms already backed up earlier this week (not re-sent). */
  alreadyDone: number;
  /** True when more pending gyms remain beyond this run's `limit`. */
  hasMore: boolean;
  emailNotConfigured: boolean;
  errors: string[];
}

/** How many gyms to email in parallel — keeps memory + Resend rate in check. */
const CONCURRENCY = 5;

/** Run `fn` over `items` with at most `limit` in flight at once. */
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/**
 * Email gym owners a full Excel export of their gym's data so they always retain
 * their own copy. Designed to scale: it only processes gyms not yet backed up
 * this week (idempotent via `gym_backup_runs`), works in bounded-concurrency
 * batches, and can be capped with `limit` for a short-lived caller (e.g. a manual
 * button). Safe to run repeatedly — a scheduled safety-net pass picks up anything
 * that failed or timed out without ever double-sending.
 *
 * Must be called with a service-role client (reads across all gyms). Pass `gymId`
 * to target one gym; `limit` to cap how many are processed this call.
 */
export async function sendWeeklyGymBackups(
  admin: SupabaseClient,
  opts: { gymId?: string; now?: Date; limit?: number } = {},
): Promise<BackupSummary> {
  const summary: BackupSummary = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    alreadyDone: 0,
    hasMore: false,
    emailNotConfigured: false,
    errors: [],
  };

  const now = opts.now ?? new Date();
  const weekStart = weekStartOf(now);
  const dateLabel = formatDate(now.toISOString().slice(0, 10));
  const stamp = now.toISOString().slice(0, 10);

  let gymQuery = admin.from("gyms").select("id, name, slug");
  if (opts.gymId) gymQuery = gymQuery.eq("id", opts.gymId);
  const { data: gymRows, error } = await gymQuery;
  if (error) {
    summary.errors.push(error.message);
    return summary;
  }
  const gyms = (gymRows ?? []) as { id: string; name: string; slug: string }[];
  if (gyms.length === 0) return summary;

  // Skip gyms already backed up this week (idempotency). If this read fails
  // (e.g. the log table isn't migrated yet), abort rather than risk re-sending
  // to every gym.
  const { data: doneRows, error: doneErr } = await admin
    .from("gym_backup_runs")
    .select("gym_id")
    .eq("week_start", weekStart)
    .eq("status", "sent");
  if (doneErr) {
    summary.errors.push(doneErr.message);
    return summary;
  }
  const done = new Set(((doneRows ?? []) as { gym_id: string }[]).map((r) => r.gym_id));

  let pending = gyms.filter((g) => !done.has(g.id));
  summary.alreadyDone = gyms.length - pending.length;

  // Cap this run and flag whether a follow-up run is needed.
  if (opts.limit != null && pending.length > opts.limit) {
    summary.hasMore = true;
    pending = pending.slice(0, opts.limit);
  }
  summary.processed = pending.length;
  if (pending.length === 0) return summary;

  // Owner email per gym (profiles.role = 'gym_owner').
  const { data: owners } = await admin
    .from("profiles")
    .select("gym_id, email")
    .eq("role", "gym_owner")
    .in("gym_id", pending.map((g) => g.id));
  const ownerEmail = new Map(
    ((owners ?? []) as { gym_id: string | null; email: string }[])
      .filter((o) => o.gym_id)
      .map((o) => [o.gym_id as string, o.email]),
  );

  await mapLimit(pending, CONCURRENCY, async (gym) => {
    const to = ownerEmail.get(gym.id);
    if (!to) {
      summary.skipped++;
      return;
    }
    try {
      const data = await loadGymExportData(admin, gym.id);
      if (!data) {
        summary.skipped++;
        return;
      }
      const wb = buildGymWorkbook(data);
      const xlsx = Buffer.from(await wb.xlsx.writeBuffer());
      const { subject, text, html } = buildBackupEmail({
        gymName: gym.name,
        dateLabel,
        memberCount: data.members.length,
        paymentCount: data.payments.length,
      });
      const res = await sendBackupEmail({
        to,
        subject,
        text,
        html,
        xlsx,
        filename: `${gym.slug}-backup-${stamp}.xlsx`,
      });
      // Record the outcome so this gym is skipped on re-runs (sent) or retried
      // by the safety-net pass (failed → overwritten on a later success).
      await admin.from("gym_backup_runs").upsert(
        {
          gym_id: gym.id,
          week_start: weekStart,
          status: res.ok ? "sent" : "failed",
          error: res.ok ? null : res.error,
          sent_at: new Date().toISOString(),
        },
        { onConflict: "gym_id,week_start" },
      );
      if (res.ok) {
        summary.sent++;
      } else {
        summary.failed++;
        if (!summary.errors.includes(res.error)) summary.errors.push(res.error);
      }
    } catch (e) {
      summary.failed++;
      const msg = e instanceof Error ? e.message : "Backup failed.";
      if (!summary.errors.includes(msg)) summary.errors.push(msg);
    }
  });

  summary.emailNotConfigured =
    summary.failed > 0 && summary.errors.every((e) => e.includes("isn't configured"));
  return summary;
}
