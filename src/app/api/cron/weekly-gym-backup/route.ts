import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWeeklyGymBackups } from "@/lib/admin/weekly-backup";

export const dynamic = "force-dynamic";
// Building + emailing a workbook per gym can take a while; give it room.
export const maxDuration = 300;

/**
 * Weekly job (Mondays): email every gym owner a full Excel export of their gym's
 * data so they always retain their own copy. Guarded by CRON_SECRET — pass it as
 * `Authorization: Bearer <secret>` (Vercel Cron does this) or `?secret=<secret>`.
 * Runs with the service-role client to read across all gyms.
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

  const summary = await sendWeeklyGymBackups(createAdminClient());
  return NextResponse.json({ ok: true, ...summary });
}

export function GET(req: NextRequest) {
  return handle(req);
}

export function POST(req: NextRequest) {
  return handle(req);
}
