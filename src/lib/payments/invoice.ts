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

/** Short thank-you + receipt summary used for the WhatsApp / email share buttons. */
export function buildInvoiceShareText(opts: {
  memberName: string;
  gymName: string;
  amount: string;
  invoiceNumber: string;
  date: string;
}): string {
  const firstName = opts.memberName.trim().split(/\s+/)[0] || opts.memberName;
  return (
    `Hi ${firstName}, thank you for your payment of ${opts.amount} at ${opts.gymName}. ` +
    `Invoice ${opts.invoiceNumber}, dated ${opts.date}. See you at the gym! 💪`
  );
}
