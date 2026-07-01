import { formatDate } from "@/lib/members/metrics";

/**
 * Days-before-expiry offsets at which a member gets a renewal reminder. Positive
 * = days before the end date; negative = days after (a post-expiry nudge). The
 * daily job sends each offset once per subscription. Pure data so it can be
 * tuned/tested without touching the send pipeline.
 */
export const REMINDER_OFFSETS = [7, 3, 1, -1] as const;
export type ReminderOffset = (typeof REMINDER_OFFSETS)[number];

/** Whole days from `today` (local midnight) to the ISO date string (YYYY-MM-DD). */
export function dayDiff(endDate: string, today: Date): number {
  const end = new Date(endDate + "T00:00:00");
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - base.getTime()) / 86_400_000);
}

/** The reminder offset a given days-left value maps to, or null if none matches. */
export function matchOffset(daysLeft: number): ReminderOffset | null {
  return REMINDER_OFFSETS.find((o) => o === daysLeft) ?? null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Build a renewal-reminder email (subject + plain text + HTML), worded for how
 * far the membership is from expiry. Pure and deterministic given its inputs.
 */
export function buildReminderEmail(opts: {
  memberName: string;
  gymName: string;
  planName: string | null;
  endDate: string | null;
  daysLeft: number;
}): { subject: string; text: string; html: string } {
  const { memberName, gymName, planName, endDate, daysLeft } = opts;
  const firstName = memberName.trim().split(/\s+/)[0] || memberName;
  const plan = planName ? `${planName} membership` : "membership";
  const when = formatDate(endDate);

  let subject: string;
  let headline: string;
  if (daysLeft < 0) {
    subject = `Your ${gymName} membership has expired`;
    headline = `your ${plan} at ${gymName} expired on ${when}.`;
  } else if (daysLeft === 0) {
    subject = `Your ${gymName} membership expires today`;
    headline = `your ${plan} at ${gymName} expires today (${when}).`;
  } else {
    const inWords = daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
    subject = `Your ${gymName} membership expires ${inWords}`;
    headline = `your ${plan} at ${gymName} is expiring ${inWords}, on ${when}.`;
  }

  const lines = [
    `Hi ${firstName},`,
    "",
    `Just a reminder — ${headline}`,
    "Renew now to keep training with us. Visit or message us and we'll set you up.",
    "",
    `— ${gymName}`,
  ];
  const text = lines.join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;line-height:1.5">
      <p style="margin:0 0 12px">Hi ${escapeHtml(firstName)},</p>
      <p style="margin:0 0 12px">Just a reminder — ${escapeHtml(capitalize(headline))}</p>
      <p style="margin:0 0 12px">Renew now to keep training with us. Visit or message us and we'll set you up.</p>
      <p style="margin:16px 0 0;color:#6b7280">— ${escapeHtml(gymName)}</p>
    </div>
  `.trim();

  return { subject, text, html };
}
