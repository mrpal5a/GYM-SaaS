import { describe, it, expect } from "vitest";
import { buildGymWelcomeEmail } from "./gym-welcome-content";

describe("buildGymWelcomeEmail", () => {
  const base = {
    ownerName: "Sagar Bhai",
    gymName: "Iron Paradise",
    plan: "professional",
    renewalDate: "6 Jul 2027",
    loginUrl: "https://app.gymflow.pro",
  };

  it("congratulates by first name and names the gym", () => {
    const { subject, text } = buildGymWelcomeEmail(base);
    expect(subject).toContain("Welcome to GymFlow Pro");
    expect(subject).toContain("Iron Paradise");
    expect(text).toContain("Hi Sagar,");
    expect(text).toContain("welcome to GymFlow Pro");
  });

  it("lists features and shows plan + renewal", () => {
    const { text } = buildGymWelcomeEmail(base);
    expect(text).toContain("Automated renewal reminders");
    expect(text).toContain("Weekly data backups");
    expect(text).toContain("Plan: Professional"); // label-cased
    expect(text).toContain("Next renewal: 6 Jul 2027");
  });

  it("includes the login link when given, and an HTML body with a feature list", () => {
    const { text, html } = buildGymWelcomeEmail(base);
    expect(text).toContain("https://app.gymflow.pro");
    expect(html).toContain("<ul");
    expect(html).toContain("Iron Paradise");
  });

  it("falls back to the raw plan value when unknown", () => {
    const { text } = buildGymWelcomeEmail({ ...base, plan: "custom" });
    expect(text).toContain("Plan: custom");
  });
});
