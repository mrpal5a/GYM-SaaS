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

/**
 * Short thank-you + receipt summary used for the WhatsApp / email share messages.
 * When `pdfUrl` is given (WhatsApp, where files can't be attached), a download link
 * for the invoice PDF is appended; email omits it because the PDF rides as an attachment.
 */
export function buildInvoiceShareText(opts: {
  memberName: string;
  gymName: string;
  amount: string;
  invoiceNumber: string;
  date: string;
  pdfUrl?: string;
}): string {
  const firstName = opts.memberName.trim().split(/\s+/)[0] || opts.memberName;
  const base =
    `Hi ${firstName}, thank you for your payment of ${opts.amount} at ${opts.gymName}. ` +
    `Invoice ${opts.invoiceNumber}, dated ${opts.date}. See you at the gym! 💪`;
  return opts.pdfUrl ? `${base}\n\nDownload your invoice: ${opts.pdfUrl}` : base;
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
  pdfUrl?: string;
}): string {
  const firstName = opts.memberName.trim().split(/\s+/)[0] || opts.memberName;
  const plan = opts.planName ? `${opts.planName} membership` : "membership";
  const validity = opts.validUntil ? ` and is valid until ${opts.validUntil}` : "";

  const lines = [
    `Hi ${firstName}, welcome to ${opts.gymName}! 🎉`,
    `Your ${plan} is now active${validity}.`,
    `Amount paid: ${opts.amount} · Invoice ${opts.invoiceNumber} (${opts.date}).`,
  ];
  if (opts.pdfUrl) lines.push(`Download your invoice: ${opts.pdfUrl}`);
  lines.push(`See you at the gym! 💪`);
  return lines.join("\n");
}
