import "server-only";
import { Resend } from "resend";

/**
 * Resend client, or null when RESEND_API_KEY isn't set yet. Callers surface a
 * friendly "email isn't configured" message instead of throwing, so the rest of
 * the app keeps working before the key lands.
 */
export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

export type SendResult = { ok: true } | { ok: false; error: string };

/**
 * Email an invoice PDF to a member. The "from" address must belong to a domain
 * verified in Resend; until then it falls back to Resend's onboarding sender,
 * which can only deliver to the account owner's own address (good enough to test).
 */
export async function sendInvoiceEmail(opts: {
  to: string;
  gymName: string;
  subject: string;
  text: string;
  pdf: Buffer;
  filename: string;
}): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: "Email isn't configured yet. Add RESEND_API_KEY to enable sending." };
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const html = opts.text
    .split("\n")
    .map((line) => `<p style="margin:0 0 12px">${escapeHtml(line)}</p>`)
    .join("");

  const { error } = await resend.emails.send({
    from: `${opts.gymName} <${fromAddress}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html,
    attachments: [{ filename: opts.filename, content: opts.pdf }],
  });

  if (error) return { ok: false, error: error.message || "Could not send the email." };
  return { ok: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
