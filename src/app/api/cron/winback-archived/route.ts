import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWinbackEmails } from "@/lib/members/winback";

export const dynamic = "force-dynamic";

/**
 * Monthly win-back job (runs on the 1st). Emails every archived member — across all
 * gyms — a "come back and rejoin" nudge, once per calendar month for up to 6 months
 * after they left. Idempotent via the winback_emails log, so it's safe to re-run.
 *
 * Protected by CRON_SECRET — pass it as `Authorization: Bearer <secret>` (Vercel
 * Cron does this automatically when CRON_SECRET is set) or `?secret=<secret>`.
 * Runs with the service-role client so it can see across all gyms.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set. Refusing to run." },
      { status: 500 },
    );
  }

  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const provided = bearer ?? req.nextUrl.searchParams.get("secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await sendWinbackEmails(createAdminClient());
  return NextResponse.json({ ok: true, ...summary });
}

export function GET(req: NextRequest) {
  return handle(req);
}

export function POST(req: NextRequest) {
  return handle(req);
}
