/**
 * Onboarding email sent to a gym owner the moment their gym is created on
 * GymFlow Pro: a warm congratulations, a tour of what the platform does (so they
 * put it to use), and their plan + next-renewal details. Pure/testable.
 */

/** The features we tell a new owner about, in the order they matter most. */
const FEATURES: { title: string; desc: string }[] = [
  { title: "Member management", desc: "Add members with photos, search & filter, and track contact details and BMI." },
  { title: "Plans & memberships", desc: "Create plans once — the app tracks active, expiring and expired members for you." },
  { title: "Payments & invoices", desc: "Record a payment and a professional invoice PDF is emailed to the member automatically." },
  { title: "Automated renewal reminders", desc: "Members are emailed before their plan expires, with one-tap WhatsApp follow-ups too." },
  { title: "Dashboard insights", desc: "Revenue, new members and renewals at a glance, with a 12-month chart you can drill into." },
  { title: "Self-service sign-up", desc: "Share your QR code / join link — new members register and pay, you just approve." },
  { title: "Personal trainer plans", desc: "Sell personal training alongside memberships." },
  { title: "Weekly data backups", desc: "Every Monday we email you a full Excel export of your data, so you never lose it." },
  { title: "Team access", desc: "Invite staff with the right permissions to help you run the gym." },
];

const PLAN_LABEL: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildGymWelcomeEmail(opts: {
  ownerName: string;
  gymName: string;
  plan: string;
  renewalDate: string;
  loginUrl?: string;
}): { subject: string; text: string; html: string } {
  const { ownerName, gymName, plan, renewalDate, loginUrl } = opts;
  const firstName = ownerName.trim().split(/\s+/)[0] || ownerName;
  const planLabel = PLAN_LABEL[plan] ?? plan;

  const subject = `Welcome to GymFlow Pro, ${gymName}! 🎉`;

  const textParts = [
    `Hi ${firstName},`,
    "",
    `Congratulations, and welcome to GymFlow Pro! 🎉 We're thrilled to have ${gymName} on board, and thank you for trusting us to help run and grow your gym.`,
    "",
    "Here's everything you can do with GymFlow Pro:",
    ...FEATURES.map((f) => `• ${f.title} — ${f.desc}`),
    "",
    "Your plan",
    `• Plan: ${planLabel}`,
    `• Next renewal: ${renewalDate}`,
    "",
  ];
  if (loginUrl) textParts.push(`Log in anytime at ${loginUrl} with the email this was sent to.`, "");
  textParts.push("Here's to a stronger, better-run gym. 💪", "— The GymFlow Pro team");
  const text = textParts.join("\n");

  const featuresHtml = FEATURES.map(
    (f) =>
      `<li style="margin:0 0 8px"><strong>${escapeHtml(f.title)}</strong> — ${escapeHtml(f.desc)}</li>`,
  ).join("");
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;line-height:1.5;max-width:600px">
      <p style="margin:0 0 12px">Hi ${escapeHtml(firstName)},</p>
      <p style="margin:0 0 12px"><strong>Congratulations, and welcome to GymFlow Pro! 🎉</strong> We're thrilled to have ${escapeHtml(gymName)} on board, and thank you for trusting us to help run and grow your gym.</p>
      <h3 style="margin:20px 0 8px;font-size:15px">Everything you can do with GymFlow Pro</h3>
      <ul style="margin:0 0 12px 18px;padding:0;color:#374151">${featuresHtml}</ul>
      <h3 style="margin:20px 0 8px;font-size:15px">Your plan</h3>
      <ul style="margin:0 0 12px 18px;padding:0;color:#374151">
        <li style="margin:0 0 4px">Plan: <strong>${escapeHtml(planLabel)}</strong></li>
        <li style="margin:0 0 4px">Next renewal: <strong>${escapeHtml(renewalDate)}</strong></li>
      </ul>
      ${loginUrl ? `<p style="margin:0 0 12px">Log in anytime at <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a> with the email this was sent to.</p>` : ""}
      <p style="margin:16px 0 4px">Here's to a stronger, better-run gym. 💪</p>
      <p style="margin:0;color:#6b7280">— The GymFlow Pro team</p>
    </div>
  `.trim();

  return { subject, text, html };
}
