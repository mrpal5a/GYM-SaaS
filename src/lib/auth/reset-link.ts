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

/**
 * App-owned staff-invite confirmation URL. Same server-side flow as reset: the
 * emailed link hits /auth/confirm, which verifies the invite token and sets the
 * session before sending the invitee on to /accept-invite to finish signing up.
 */
export function buildInviteConfirmUrl(baseUrl: string, tokenHash: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: "invite",
    next: "/accept-invite",
  });
  return `${base}/auth/confirm?${params.toString()}`;
}
