import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/**
 * Lightweight, unauthenticated health/version probe — for uptime monitors and to
 * verify a deploy landed with the right config. Returns only non-sensitive info:
 * the resolved public site URL (confirms NEXT_PUBLIC_SITE_URL), the short commit
 * SHA of the running build, and a timestamp.
 */
export function GET() {
  return NextResponse.json({
    ok: true,
    siteUrl: siteUrl(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    time: new Date().toISOString(),
  });
}
