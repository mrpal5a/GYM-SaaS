import { describe, expect, it } from "vitest";
import {
  REMINDER_OFFSETS,
  buildReminderEmail,
  dayDiff,
  matchOffset,
} from "./reminder-content";

describe("dayDiff", () => {
  const today = new Date("2026-07-01T09:00:00"); // local-time midday

  it("counts whole days to a future date", () => {
    expect(dayDiff("2026-07-08", today)).toBe(7);
    expect(dayDiff("2026-07-02", today)).toBe(1);
  });

  it("returns 0 for today and negatives for the past", () => {
    expect(dayDiff("2026-07-01", today)).toBe(0);
    expect(dayDiff("2026-06-30", today)).toBe(-1);
  });
});

describe("matchOffset", () => {
  it("matches only the configured offsets", () => {
    for (const o of REMINDER_OFFSETS) expect(matchOffset(o)).toBe(o);
    expect(matchOffset(5)).toBeNull();
    expect(matchOffset(-2)).toBeNull();
    expect(matchOffset(0)).toBeNull(); // 0 is intentionally not a reminder day
  });
});

describe("buildReminderEmail", () => {
  const base = {
    memberName: "Riya Khan",
    gymName: "Iron Temple",
    planName: "Monthly",
    endDate: "2026-07-02",
  };

  it("uses 'tomorrow' wording one day out", () => {
    const { subject, text } = buildReminderEmail({ ...base, daysLeft: 1 });
    expect(subject).toContain("expires tomorrow");
    expect(text).toContain("Hi Riya,");
    expect(text).toContain("Monthly membership at Iron Temple");
  });

  it("uses 'in N days' wording further out", () => {
    const { subject } = buildReminderEmail({ ...base, daysLeft: 7 });
    expect(subject).toContain("expires in 7 days");
  });

  it("uses past-tense wording once expired", () => {
    const { subject, text } = buildReminderEmail({ ...base, daysLeft: -1 });
    expect(subject).toContain("has expired");
    expect(text).toContain("expired on");
  });

  it("falls back to 'membership' when no plan name", () => {
    const { text } = buildReminderEmail({ ...base, planName: null, daysLeft: 3 });
    expect(text).toContain("your membership at Iron Temple");
  });
});
