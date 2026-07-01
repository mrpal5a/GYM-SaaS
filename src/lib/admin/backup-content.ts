/**
 * Monday (local) of the given date, as an ISO date string — the idempotency
 * bucket for the weekly backup log. Any day within a week maps to the same
 * Monday, so the scheduled run and a manual trigger share one key.
 */
export function weekStartOf(now: Date): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun … 6 = Sat
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); // back to Monday
  // Format in local time — toISOString() would shift the date in non-UTC zones.
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

/**
 * Body of the weekly gym-data backup email. Pure/testable — the engine attaches
 * the Excel workbook separately. Reassures the owner this is their safety copy
 * so they never lose their data, even if service access is interrupted.
 */
export function buildBackupEmail(opts: {
  gymName: string;
  dateLabel: string;
  memberCount: number;
  paymentCount: number;
}): { subject: string; text: string; html: string } {
  const { gymName, dateLabel, memberCount, paymentCount } = opts;
  const subject = `${gymName} — your weekly data backup (${dateLabel})`;

  const text = [
    `Hi ${gymName} team,`,
    "",
    `Attached is your automatic weekly backup of all your GymFlow data as of ${dateLabel}.`,
    "",
    "The Excel file contains:",
    `• Members (${memberCount})`,
    "• Membership plans",
    "• Subscriptions",
    `• Payment history (${paymentCount})`,
    "• Gym info",
    "",
    "Please keep this file somewhere safe. It's your own copy of your data, so you'll always have your members and payment history on hand — even if your access to GymFlow is ever interrupted.",
    "",
    "You'll receive a fresh backup every Monday.",
    "",
    "— GymFlow Pro",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;line-height:1.5;max-width:560px">
      <p style="margin:0 0 12px">Hi ${escapeHtml(gymName)} team,</p>
      <p style="margin:0 0 12px">Attached is your automatic weekly backup of all your GymFlow data as of <strong>${escapeHtml(dateLabel)}</strong>.</p>
      <p style="margin:0 0 6px">The Excel file contains:</p>
      <ul style="margin:0 0 12px 18px;padding:0;color:#374151">
        <li>Members (${memberCount})</li>
        <li>Membership plans</li>
        <li>Subscriptions</li>
        <li>Payment history (${paymentCount})</li>
        <li>Gym info</li>
      </ul>
      <p style="margin:0 0 12px;color:#374151">Please keep this file somewhere safe. It's your own copy of your data, so you'll always have your members and payment history on hand — even if your access to GymFlow is ever interrupted.</p>
      <p style="margin:0 0 12px;color:#6b7280">You'll receive a fresh backup every Monday.</p>
      <p style="margin:0;color:#6b7280">— GymFlow Pro</p>
    </div>
  `.trim();

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
