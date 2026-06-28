import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Verifies an emailed auth token (e.g. password recovery) server-side: verifyOtp
 * exchanges the token_hash for a session cookie, then we send the user on to
 * `next`. Used by the password-reset email link. A bad/expired token bounces back
 * to /login with a friendly note.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next");
  // Only allow same-site relative paths. Must start with a single "/" — reject
  // protocol-relative ("//host") and backslash ("/\\host") forms, which new URL()
  // would otherwise resolve to an external origin (open redirect).
  const isSafeNext =
    !!nextParam && /^\/(?![/\\])/.test(nextParam);
  const next = isSafeNext ? nextParam : "/reset-password";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=reset_link", request.url));
}
