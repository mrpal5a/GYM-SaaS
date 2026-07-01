import "server-only";
import nodemailer from "nodemailer";

export type SendResult = { ok: true } | { ok: false; error: string };

/**
 * Build a Nodemailer transport from SMTP_* env vars, or null when they're not
 * configured yet — callers surface a friendly "email isn't configured" message
 * instead of throwing. `secure` is inferred from the port (465 = implicit TLS).
 */
function getTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/** Email a password-reset link via SMTP (Nodemailer). */
export async function sendPasswordResetEmail(opts: {
  to: string;
  resetUrl: string;
}): Promise<SendResult> {
  const transport = getTransport();
  if (!transport) {
    return {
      ok: false,
      error: "Email isn't configured yet. Add SMTP_HOST/SMTP_USER/SMTP_PASS to enable sending.",
    };
  }

  // SMTP_FROM may already be a full "Name <email>" header; use it verbatim and
  // only synthesize a default display name when it's absent.
  const from = process.env.SMTP_FROM ?? `GymFlow <${process.env.SMTP_USER}>`;
  const text = [
    "We received a request to reset your GymFlow password.",
    "",
    "Reset your password using the link below (it expires in about an hour):",
    opts.resetUrl,
    "",
    "If you didn't request this, you can safely ignore this email — your password won't change.",
  ].join("\n");
  const html = `
    <p>We received a request to reset your GymFlow password.</p>
    <p>
      <a href="${opts.resetUrl}" style="display:inline-block;padding:10px 18px;background:#111827;color:#fff;border-radius:8px;text-decoration:none">
        Reset your password
      </a>
    </p>
    <p style="color:#6b7280;font-size:13px">This link expires in about an hour. If you didn't request a reset, you can safely ignore this email — your password won't change.</p>
    <p style="color:#9ca3af;font-size:12px;word-break:break-all">${opts.resetUrl}</p>
  `;

  try {
    await transport.sendMail({
      from,
      to: opts.to,
      subject: "Reset your GymFlow password",
      text,
      html,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not send the email." };
  }
}

/** Email a staff-invite link (our own /auth/confirm URL) via SMTP. */
export async function sendStaffInviteEmail(opts: {
  to: string;
  inviteUrl: string;
  gymName: string;
}): Promise<SendResult> {
  const transport = getTransport();
  if (!transport) {
    return {
      ok: false,
      error: "Email isn't configured yet. Add SMTP_HOST/SMTP_USER/SMTP_PASS to enable sending.",
    };
  }

  const from = process.env.SMTP_FROM ?? `GymFlow <${process.env.SMTP_USER}>`;
  const safeGym = opts.gymName.replace(/</g, "&lt;");
  const text = [
    `You've been invited to join ${opts.gymName} on GymFlow Pro as a staff member.`,
    "",
    "Set your password and get started using the link below (it expires in about an hour):",
    opts.inviteUrl,
    "",
    "If you weren't expecting this, you can safely ignore this email.",
  ].join("\n");
  const html = `
    <p>You've been invited to join <strong>${safeGym}</strong> on GymFlow Pro as a staff member.</p>
    <p>
      <a href="${opts.inviteUrl}" style="display:inline-block;padding:10px 18px;background:#111827;color:#fff;border-radius:8px;text-decoration:none">
        Accept invite &amp; set password
      </a>
    </p>
    <p style="color:#6b7280;font-size:13px">This link expires in about an hour. If you weren't expecting this, you can safely ignore this email.</p>
    <p style="color:#9ca3af;font-size:12px;word-break:break-all">${opts.inviteUrl}</p>
  `;

  try {
    await transport.sendMail({
      from,
      to: opts.to,
      subject: `You're invited to join ${opts.gymName} on GymFlow`,
      text,
      html,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not send the email." };
  }
}
