// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildMonthlyStats } from "./monthly-stats";

// Fixed "now" mid-month so the 6-month window is Jan..Jun 2026 and bucketing is
// stable across time zones.
const NOW = new Date("2026-06-15T12:00:00Z");

const empty = { payments: [], members: [], subscriptions: [] };

describe("buildMonthlyStats", () => {
  it("returns exactly 6 buckets, oldest to newest", () => {
    const r = buildMonthlyStats(empty, NOW);
    expect(r).toHaveLength(6);
    expect(r.map((p) => p.label)).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun"]);
    expect(r[0].fullLabel).toBe("January 2026");
    expect(r[5].fullLabel).toBe("June 2026");
  });

  it("zero-fills months with no data", () => {
    const r = buildMonthlyStats(empty, NOW);
    for (const p of r) {
      expect([p.revenue, p.newMembers, p.expiring, p.payments]).toEqual([0, 0, 0, 0]);
    }
  });

  it("sums revenue and counts payments per month", () => {
    const r = buildMonthlyStats(
      {
        payments: [
          { paid_at: "2026-03-10T09:00:00Z", amount: 1000 },
          { paid_at: "2026-03-22T18:00:00Z", amount: 2000 },
          { paid_at: "2026-05-01T08:00:00Z", amount: 500 },
        ],
        members: [],
        subscriptions: [],
      },
      NOW,
    );
    const mar = r.find((p) => p.label === "Mar")!;
    const may = r.find((p) => p.label === "May")!;
    expect(mar.revenue).toBe(3000);
    expect(mar.payments).toBe(2);
    expect(may.revenue).toBe(500);
    expect(may.payments).toBe(1);
  });

  it("counts new members by joined_at month", () => {
    const r = buildMonthlyStats(
      { payments: [], members: [{ joined_at: "2026-04-10" }, { joined_at: "2026-04-28" }], subscriptions: [] },
      NOW,
    );
    expect(r.find((p) => p.label === "Apr")!.newMembers).toBe(2);
  });

  it("counts expiring memberships by end_date month, ignoring null end dates", () => {
    const r = buildMonthlyStats(
      {
        payments: [],
        members: [],
        subscriptions: [{ end_date: "2026-05-20" }, { end_date: "2026-05-01" }, { end_date: null }],
      },
      NOW,
    );
    expect(r.find((p) => p.label === "May")!.expiring).toBe(2);
  });

  it("ignores data outside the 6-month window", () => {
    const r = buildMonthlyStats(
      {
        payments: [
          { paid_at: "2025-12-31T10:00:00Z", amount: 9999 }, // before window
          { paid_at: "2026-08-01T10:00:00Z", amount: 8888 }, // future, outside
        ],
        members: [{ joined_at: "2025-11-01" }],
        subscriptions: [{ end_date: "2026-09-15" }],
      },
      NOW,
    );
    expect(r.reduce((s, p) => s + p.revenue, 0)).toBe(0);
    expect(r.reduce((s, p) => s + p.newMembers, 0)).toBe(0);
    expect(r.reduce((s, p) => s + p.expiring, 0)).toBe(0);
  });

  it("supports a custom number of months", () => {
    const r = buildMonthlyStats(empty, NOW, 12);
    expect(r).toHaveLength(12);
    expect(r[0].fullLabel).toBe("July 2025");
    expect(r[11].fullLabel).toBe("June 2026");
  });

  it("buckets a first-of-month date into that month", () => {
    const r = buildMonthlyStats(
      { payments: [], members: [{ joined_at: "2026-06-01" }], subscriptions: [] },
      NOW,
    );
    expect(r.find((p) => p.label === "Jun")!.newMembers).toBe(1);
  });
});
