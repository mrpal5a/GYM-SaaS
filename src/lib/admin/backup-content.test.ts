import { describe, it, expect } from "vitest";
import { buildBackupEmail, weekStartOf } from "./backup-content";

describe("weekStartOf", () => {
  it("returns the same Monday for every day of that week", () => {
    // Mon 6 Jul 2026 through Sun 12 Jul 2026 all map to 2026-07-06.
    const monday = "2026-07-06";
    for (let d = 6; d <= 12; d++) {
      const date = new Date(2026, 6, d, 15, 0, 0); // local midday
      expect(weekStartOf(date)).toBe(monday);
    }
  });

  it("rolls a Sunday back to the previous Monday", () => {
    expect(weekStartOf(new Date(2026, 6, 5, 9, 0, 0))).toBe("2026-06-29");
  });
});

describe("buildBackupEmail", () => {
  const base = { gymName: "Iron Paradise", dateLabel: "6 Jul 2026", memberCount: 42, paymentCount: 130 };

  it("names the gym and date in the subject", () => {
    const { subject } = buildBackupEmail(base);
    expect(subject).toContain("Iron Paradise");
    expect(subject).toContain("6 Jul 2026");
    expect(subject.toLowerCase()).toContain("backup");
  });

  it("lists the counts and reassures about data safety", () => {
    const { text } = buildBackupEmail(base);
    expect(text).toContain("Members (42)");
    expect(text).toContain("Payment history (130)");
    expect(text).toContain("even if your access to GymFlow is ever interrupted");
    expect(text).toContain("every Monday");
  });

  it("produces an HTML body with a list", () => {
    const { html } = buildBackupEmail(base);
    expect(html).toContain("<ul");
    expect(html).toContain("Iron Paradise");
  });
});
