import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendRenewalReminders } from "@/lib/members/reminders";
import { sendWeeklyGymBackups } from "@/lib/admin/weekly-backup";
import { sendWinbackEmails } from "@/lib/members/winback";

export const dynamic = "force-dynamic";
// A run may include the weekly backup (workbook build + email per gym), so give
// the whole dispatch the same headroom that job had on its own.
export const maxDuration = 300;

/**
 * Single daily cron dispatcher. The Vercel Hobby plan runs each cron job at most
 * once per day, so instead of separate daily/weekly/monthly crons we schedule ONE
 * daily job and decide here what to run today (all times in UTC, matching how
 * Vercel evaluates cron schedules):
 *
 *   - renewal reminders → every day
 *   - weekly gym backups → Mondays (getUTCDay() === 1)
 *   - win-back emails    → the 1st of the month (getUTCDate() === 1)
 *
 * Each underlying job is idempotent, so a retry can't double-send. Guarded by
 * CRON_SECRET — pass it as `Authorization: Bearer <secret>` (Vercel Cron does this
 * automatically) or `?secret=<secret>`. Runs with the service-role client.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set. Refusing to run." }, { status: 500 });
  }

  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const provided = bearer ?? req.nextUrl.searchParams.get("secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const isMonday = now.getUTCDay() === 1;
  const isFirstOfMonth = now.getUTCDate() === 1;

  // Run each job in isolation so one throwing (a bug, a timeout mid-workbook, etc.)
  // can't skip the others or 500 the whole cron. Each underlying job is already
  // idempotent, so a partial run is safely retried on the next daily invocation.
  async function runJob<T>(shouldRun: boolean, job: () => Promise<T>) {
    if (!shouldRun) return { ran: false as const };
    try {
      return { ran: true as const, result: await job() };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error("[cron/daily] job failed:", error);
      return { ran: true as const, error };
    }
  }

  const renewals = await runJob(true, () => sendRenewalReminders(admin, { now }));
  const backups = await runJob(isMonday, () => sendWeeklyGymBackups(admin));
  const winback = await runJob(isFirstOfMonth, () => sendWinbackEmails(admin, { now }));

  return NextResponse.json({ ok: true, renewals, backups, winback });
}

export function GET(req: NextRequest) {
  return handle(req);
}

export function POST(req: NextRequest) {
  return handle(req);
}
