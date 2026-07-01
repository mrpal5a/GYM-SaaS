/**
 * Human-readable, date-encoded invoice number: `INV-DDMMYYYYHHMMSS`.
 * e.g. a payment on 25 Jun 2026 at 17:23:45 -> "INV-25062026172345".
 * The embedded timestamp lets anyone read the date straight off the invoice,
 * and the seconds component keeps numbers unique even within the same minute.
 */
export function generateInvoiceNumber(date: Date = new Date()): string {
  const p = (n: number, len = 2) => String(n).padStart(len, "0");
  const stamp =
    p(date.getDate()) +
    p(date.getMonth() + 1) +
    p(date.getFullYear(), 4) +
    p(date.getHours()) +
    p(date.getMinutes()) +
    p(date.getSeconds());
  return `INV-${stamp}`;
}

/** Human label for a stored payment method (e.g. "bank_transfer" -> "Bank transfer"). */
export function methodLabel(method: string): string {
  if (method === "bank_transfer") return "Bank transfer";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

/** "For: {purpose} ({plan}) · {period}" — the parts that are present, or null. */
function detailLine(
  purpose?: string,
  planName?: string | null,
  period?: string | null,
): string | null {
  const parts: string[] = [];
  if (purpose) parts.push(purpose);
  if (planName) parts.push(purpose ? `(${planName})` : planName);
  if (period) parts.push(`· ${period}`);
  return parts.length ? `For: ${parts.join(" ")}` : null;
}

/**
 * Short thank-you + receipt summary used for the WhatsApp / email share messages.
 * Includes what the invoice is for (new/renewal) and the period it covers when
 * known. When `pdfUrl` is given (WhatsApp, where files can't be attached), a
 * download link for the invoice PDF is appended; email omits it because the PDF
 * rides as an attachment.
 */
export function buildInvoiceShareText(opts: {
  memberName: string;
  gymName: string;
  amount: string;
  invoiceNumber: string;
  date: string;
  purpose?: string;
  planName?: string | null;
  period?: string | null;
  pdfUrl?: string;
}): string {
  const firstName = opts.memberName.trim().split(/\s+/)[0] || opts.memberName;
  const lines = [
    `Hi ${firstName}, thank you for your payment of ${opts.amount} at ${opts.gymName}.`,
  ];
  const detail = detailLine(opts.purpose, opts.planName, opts.period);
  if (detail) lines.push(detail);
  lines.push(`Invoice ${opts.invoiceNumber}, dated ${opts.date}.`);
  if (opts.pdfUrl) lines.push(`Download your invoice: ${opts.pdfUrl}`);
  lines.push("See you at the gym! 💪");
  return lines.join("\n");
}

/**
 * Welcome message sent the moment a join request is approved. Unlike the plain
 * receipt text, this greets the new member and confirms their plan + validity +
 * payment, then links the invoice PDF (WhatsApp) when one is hosted. Used for both
 * the WhatsApp share and the approval email body so the two stay in sync.
 */
export function buildWelcomeMessage(opts: {
  memberName: string;
  gymName: string;
  planName: string | null;
  validUntil: string | null;
  amount: string;
  invoiceNumber: string;
  date: string;
  period?: string | null;
  pdfUrl?: string;
}): string {
  const firstName = opts.memberName.trim().split(/\s+/)[0] || opts.memberName;
  const plan = opts.planName ? `${opts.planName} membership` : "membership";
  const validity = opts.period
    ? ` and is valid ${opts.period}`
    : opts.validUntil
      ? ` and is valid until ${opts.validUntil}`
      : "";

  const lines = [
    `Hi ${firstName}, welcome to ${opts.gymName}! 🎉`,
    `Your ${plan} is now active${validity}.`,
    `Amount paid: ${opts.amount} · Invoice ${opts.invoiceNumber} (${opts.date}).`,
  ];
  if (opts.pdfUrl) lines.push(`Download your invoice: ${opts.pdfUrl}`);
  lines.push(`See you at the gym! 💪`);
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Rich onboarding email sent when a member first joins: a warm congratulations,
 * their plan details, the gym's rules, and (attached by the caller) their
 * invoice PDF. Returns subject + plain-text + HTML bodies. Unlike
 * {@link buildWelcomeMessage} (kept short for WhatsApp), this is the long-form
 * email version.
 */
export function buildWelcomeEmail(opts: {
  memberName: string;
  gymName: string;
  planName: string | null;
  period: string | null;
  validUntil: string | null;
  amount: string;
  invoiceNumber: string;
  date: string;
  rules: string[];
}): { subject: string; text: string; html: string } {
  const firstName = opts.memberName.trim().split(/\s+/)[0] || opts.memberName;
  const plan = opts.planName ? `${opts.planName} membership` : "membership";
  const validity = opts.period ?? (opts.validUntil ? `until ${opts.validUntil}` : null);
  const rules = opts.rules.filter((r) => r.trim().length > 0);

  const subject = `Welcome to ${opts.gymName} — your membership is active! 🎉`;

  // --- Plain text ---
  const detail: string[] = [`• Plan: ${plan}`];
  if (validity) detail.push(`• Valid: ${validity}`);
  detail.push(`• Amount paid: ${opts.amount}`);
  detail.push(`• Invoice: ${opts.invoiceNumber} (${opts.date})`);

  const textParts = [
    `Hi ${firstName},`,
    "",
    `Welcome to ${opts.gymName}! 🎉 Congratulations on becoming a member — we're thrilled to have you on board and can't wait to help you reach your goals.`,
    "",
    "Your membership",
    ...detail,
  ];
  if (rules.length) {
    textParts.push("", "A few gym rules to keep in mind:");
    rules.forEach((r, i) => textParts.push(`${i + 1}. ${r}`));
  }
  textParts.push(
    "",
    "Your invoice is attached to this email for your records.",
    "",
    `See you at the gym! 💪`,
    `— ${opts.gymName}`,
  );
  const text = textParts.join("\n");

  // --- HTML ---
  const detailHtml = detail
    .map((d) => `<li style="margin:0 0 4px">${escapeHtml(d.replace(/^•\s?/, ""))}</li>`)
    .join("");
  const rulesHtml = rules.length
    ? `<h3 style="margin:20px 0 8px;font-size:15px">A few gym rules to keep in mind</h3>
       <ol style="margin:0 0 0 18px;padding:0;color:#374151">${rules
         .map((r) => `<li style="margin:0 0 4px">${escapeHtml(r)}</li>`)
         .join("")}</ol>`
    : "";
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;line-height:1.5;max-width:560px">
      <p style="margin:0 0 12px">Hi ${escapeHtml(firstName)},</p>
      <p style="margin:0 0 12px"><strong>Welcome to ${escapeHtml(opts.gymName)}! 🎉</strong> Congratulations on becoming a member — we're thrilled to have you on board and can't wait to help you reach your goals.</p>
      <h3 style="margin:20px 0 8px;font-size:15px">Your membership</h3>
      <ul style="margin:0 0 0 18px;padding:0;color:#374151;list-style:none">${detailHtml}</ul>
      ${rulesHtml}
      <p style="margin:20px 0 12px;color:#374151">Your invoice is attached to this email for your records.</p>
      <p style="margin:0 0 4px">See you at the gym! 💪</p>
      <p style="margin:0;color:#6b7280">— ${escapeHtml(opts.gymName)}</p>
    </div>
  `.trim();

  return { subject, text, html };
}
