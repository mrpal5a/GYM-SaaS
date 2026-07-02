/**
 * How many months after archiving a member keeps receiving the monthly win-back
 * email. After this, we stop nudging people who clearly aren't returning.
 */
export const WINBACK_MAX_MONTHS = 6;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Build the monthly "we'd love to have you back" email (subject + plain text +
 * HTML). Includes the gym's public join link so a former member can re-register in
 * one tap. Pure and deterministic given its inputs.
 */
export function buildWinbackEmail(opts: {
  memberName: string;
  gymName: string;
  joinUrl: string;
}): { subject: string; text: string; html: string } {
  const { memberName, gymName, joinUrl } = opts;
  const firstName = memberName.trim().split(/\s+/)[0] || memberName;

  const subject = `We miss you at ${gymName} — come back and train with us`;

  const text = [
    `Hi ${firstName},`,
    "",
    `It's been a while since we saw you at ${gymName}, and we'd love to have you back.`,
    "",
    `Whenever you're ready to restart your fitness journey, you can rejoin in under a minute here:`,
    joinUrl,
    "",
    `Your health is worth it — we're here whenever you are.`,
    "",
    `See you soon,`,
    `Team ${gymName}`,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;line-height:1.6">
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>It's been a while since we saw you at <strong>${escapeHtml(gymName)}</strong>, and we'd love to have you back.</p>
      <p>Whenever you're ready to restart your fitness journey, you can rejoin in under a minute:</p>
      <p>
        <a href="${escapeHtml(joinUrl)}"
           style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">
          Rejoin ${escapeHtml(gymName)}
        </a>
      </p>
      <p>Your health is worth it — we're here whenever you are.</p>
      <p>See you soon,<br/>Team ${escapeHtml(gymName)}</p>
    </div>
  `.trim();

  return { subject, text, html };
}
