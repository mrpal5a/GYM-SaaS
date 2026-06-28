/**
 * App-owned password-reset confirmation URL. The email links here (not to
 * Supabase) so /auth/confirm can verify the recovery token server-side and set
 * the session before sending the user on to /reset-password.
 */
export function buildResetConfirmUrl(baseUrl: string, tokenHash: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: "recovery",
    next: "/reset-password",
  });
  return `${base}/auth/confirm?${params.toString()}`;
}
