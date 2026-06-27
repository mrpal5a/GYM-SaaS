import { describe, it, expect } from "vitest";
import { subscriptionExpiryStatus } from "./expiry";

const NOW = new Date("2026-06-28T12:00:00Z");

describe("subscriptionExpiryStatus", () => {
  it("returns 'expired' when the period end is in the past", () => {
    expect(subscriptionExpiryStatus("2026-06-01T00:00:00Z", NOW)).toBe("expired");
  });

  it("returns 'expiring_soon' within 14 days", () => {
    expect(subscriptionExpiryStatus("2026-07-05T00:00:00Z", NOW)).toBe("expiring_soon");
  });

  it("returns 'active' beyond 14 days", () => {
    expect(subscriptionExpiryStatus("2026-09-01T00:00:00Z", NOW)).toBe("active");
  });

  it("treats the boundary (exactly 14 days out) as expiring_soon", () => {
    expect(subscriptionExpiryStatus("2026-07-12T12:00:00Z", NOW)).toBe("expiring_soon");
  });

  it("returns 'none' when there is no period end", () => {
    expect(subscriptionExpiryStatus(null, NOW)).toBe("none");
  });
});
