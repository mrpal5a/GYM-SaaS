# Forgot / reset password

**Date:** 2026-06-28
**Status:** Approved

## Problem

The login page has no way to recover a forgotten password. A gym owner who forgets
their password is locked out with no self-service path.

## Goal

Let a user request a password-reset link from the login page, receive it by email
(sent via the gym's own SMTP using Nodemailer), and set a new password through a
secure, single-use link.

## Flow

1. **Login page** — a "Forgot password?" link → `/forgot-password`.
2. **`/forgot-password`** — email field → `requestPasswordResetAction`:
   - Generates a recovery token server-side with the admin client
     `admin.auth.admin.generateLink({ type: 'recovery', email })` (this returns a
     token and sends no email).
   - Builds the app's own confirm link via `buildResetConfirmUrl(tokenHash)`:
     `${siteUrl}/auth/confirm?token_hash=<token>&type=recovery&next=/reset-password`.
   - Sends that link with Nodemailer/SMTP.
   - Always returns the same generic success message, even if the email is not
     registered (anti-enumeration).
3. **`/auth/confirm`** (GET route handler) — reads `token_hash`, `type`, `next`;
   calls `supabase.auth.verifyOtp({ type: 'recovery', token_hash })` (sets the
   recovery session cookie via the SSR server client), then redirects to `next`
   (`/reset-password`). A missing/invalid/expired token redirects to
   `/login?error=reset_link` so the login page can show a friendly note.
4. **`/reset-password`** — new-password field → `resetPasswordAction`: confirms the
   recovery session (`getUser`), calls `updateUser({ password })`, then redirects to
   `/login` to sign in fresh.

The `/auth/confirm` route is the server-side token→session step the app was missing;
it works regardless of PKCE/implicit configuration and needs no browser client.

## Email (Nodemailer)

`src/lib/email/smtp.ts` builds a Nodemailer transport from env vars and exposes
`sendPasswordResetEmail({ to, resetUrl })`:

- Env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- If SMTP is not configured, returns a friendly error (mirrors the Resend layer's
  graceful-degradation pattern) instead of throwing.
- Body: plain text + simple HTML; states the link expires (~1 hour) and "ignore this
  email if you didn't request a reset."

## Files

1. `package.json` — add `nodemailer` and `@types/nodemailer` (dev).
2. `src/lib/email/smtp.ts` — transport + `sendPasswordResetEmail`.
3. `src/lib/auth/reset-link.ts` — pure `buildResetConfirmUrl(tokenHash, baseUrl?)`.
4. `src/lib/validations/auth.ts` — add `forgotPasswordSchema` (email) and
   `resetPasswordSchema` (password, min 8 — consistent with invite/change-password).
5. `src/actions/password-reset.ts` — `requestPasswordResetAction`,
   `resetPasswordAction`.
6. `src/app/(auth)/forgot-password/page.tsx` + `src/components/auth/forgot-password-form.tsx`.
7. `src/app/(auth)/reset-password/page.tsx` + `src/components/auth/reset-password-form.tsx`.
8. `src/app/auth/confirm/route.ts` — `verifyOtp` + redirect.
9. `src/proxy.ts` — add `/forgot-password`, `/reset-password`, `/auth/confirm` to the
   PUBLIC list so unauthenticated users can reach them.
10. `src/components/auth/login-form.tsx` — "Forgot password?" link.
11. `.env.example` (and the user's `.env.local`) — document the SMTP vars.

## Data flow

```
/forgot-password (form)
  -> requestPasswordResetAction(email)
       -> admin.generateLink({ type:'recovery', email })  // token, no email sent
       -> buildResetConfirmUrl(tokenHash)
       -> sendPasswordResetEmail({ to, resetUrl })          // Nodemailer/SMTP
       -> generic success (always)

email link -> /auth/confirm?token_hash&type=recovery&next=/reset-password
  -> verifyOtp({ type:'recovery', token_hash })  // sets recovery session cookie
  -> redirect /reset-password

/reset-password (form)
  -> resetPasswordAction(password)
       -> getUser() (recovery session)
       -> updateUser({ password })
       -> redirect /login
```

## Security / edge cases

- **Anti-enumeration**: `requestPasswordResetAction` returns the same success
  message whether or not the email exists; a `generateLink` "user not found" error is
  caught and treated as success.
- Tokens are single-use and expire (Supabase default ~1 hour).
- Invalid/expired confirm link → `/login?error=reset_link` with a friendly message.
- `/reset-password` with no recovery session → the action reports the link is invalid
  or expired and points the user back to request a new one.

## Testing

- Unit tests (TDD): `forgotPasswordSchema`, `resetPasswordSchema`, and
  `buildResetConfirmUrl` (URL shape, encoding, base-url override).
- Actions, the `/auth/confirm` route, and the SMTP send are I/O — verified manually:
  request a reset for a real account, receive the email, click the link, set a new
  password, and log in with it. Also confirm an unregistered email still shows the
  generic success message.

## Out of scope (YAGNI)

- Rate-limiting the forgot-password endpoint (worth adding later to prevent
  email-bombing; the join flow has a reusable rate-limit helper).
- Migrating the existing staff-invite flow onto the new `/auth/confirm` route.
