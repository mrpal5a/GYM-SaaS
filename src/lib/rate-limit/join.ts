import "server-only";
import { headers } from "next/headers";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

// Window + ceilings for the public join form. A real client submits once; these
// leave generous headroom for retries/typos while stopping scripted spam. Tune
// here — they're passed to register_join_attempt (migration 0017).
const WINDOW_SECONDS = 60 * 60; // 1 hour
const MAX_PER_IP = 5; // one client / shared NAT, per gym, per hour
const MAX_PER_GYM = 60; // total intake for one gym per hour (storage guard)

/**
 * Extract the client IP from a forwarded-for-style header value. `x-forwarded-for`
 * is a comma-separated list "client, proxy1, proxy2"; the left-most entry is the
 * originating client. Pure (no request access) so it's unit-testable.
 */
export function parseClientIp(forwardedFor: string | null, realIp: string | null): string {
  const first = forwardedFor?.split(",")[0]?.trim();
  return first || realIp?.trim() || "unknown";
}

/** Read the caller's IP from request headers (Vercel/most proxies set these). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return parseClientIp(h.get("x-forwarded-for"), h.get("x-real-ip"));
}

/**
 * Returns true when this join submission is within the rate limits (and records
 * it), false when it should be rejected. Fails OPEN — if the limiter RPC errors we
 * allow the request rather than break legitimate signups over a limiter hiccup.
 */
export async function checkJoinRateLimit(admin: Admin, gymId: string, ip: string): Promise<boolean> {
  const { data, error } = await admin.rpc("register_join_attempt", {
    p_gym_id: gymId,
    p_ip: ip,
    p_max_per_ip: MAX_PER_IP,
    p_max_per_gym: MAX_PER_GYM,
    p_window_seconds: WINDOW_SECONDS,
  });
  if (error) return true; // fail open
  return data !== false;
}
