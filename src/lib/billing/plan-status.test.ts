// @vitest-environment node
import { describe, it, expect } from "vitest";
import { getPlanBanner } from "./plan-status";

// Fixed "now" at midday UTC so the calendar date is stable across time zones.
const NOW = new Date("2026-06-28T12:00:00Z");

describe("getPlanBanner", () => {
  it("warns (expiring) when the period ends in exactly 15 days", () => {
    expect(getPlanBanner({ status: "active", currentPeriodEnd: "2026-07-13" }, NOW)).toEqual({
      severity: "expiring",
      days: 15,
    });
  });

  it("warns (expiring) when the period ends in 1 day", () => {
    expect(getPlanBanner({ status: "active", currentPeriodEnd: "2026-06-29" }, NOW)).toEqual({
      severity: "expiring",
      days: 1,
    });
  });

  it("does not warn when the period ends in 16 days", () => {
    expect(getPlanBanner({ status: "active", currentPeriodEnd: "2026-07-14" }, NOW)).toBeNull();
  });

  it("treats a trialing plan ending soon the same as active", () => {
    expect(getPlanBanner({ status: "trialing", currentPeriodEnd: "2026-07-05" }, NOW)).toEqual({
      severity: "expiring",
      days: 7,
    });
  });

  it("flags expired when the period end is in the past", () => {
    const result = getPlanBanner({ status: "active", currentPeriodEnd: "2026-06-20" }, NOW);
    expect(result?.severity).toBe("expired");
  });

  it("flags expired when the period ends today", () => {
    const result = getPlanBanner({ status: "active", currentPeriodEnd: "2026-06-28" }, NOW);
    expect(result?.severity).toBe("expired");
  });

  it("flags expired when status is past_due, even with a future period end", () => {
    const result = getPlanBanner({ status: "past_due", currentPeriodEnd: "2027-01-01" }, NOW);
    expect(result?.severity).toBe("expired");
  });

  it("flags expired when status is canceled", () => {
    const result = getPlanBanner({ status: "canceled", currentPeriodEnd: "2027-01-01" }, NOW);
    expect(result?.severity).toBe("expired");
  });

  it("handles a full ISO timestamp for the period end", () => {
    expect(
      getPlanBanner({ status: "active", currentPeriodEnd: "2026-07-13T00:00:00.000Z" }, NOW),
    ).toEqual({ severity: "expiring", days: 15 });
  });

  it("returns null for an active plan with no period end", () => {
    expect(getPlanBanner({ status: "active", currentPeriodEnd: null }, NOW)).toBeNull();
  });

  it("returns null when there is no subscription data", () => {
    expect(getPlanBanner({ status: null, currentPeriodEnd: null }, NOW)).toBeNull();
  });
});
