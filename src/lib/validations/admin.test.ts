import { describe, it, expect } from "vitest";
import { onboardGymSchema, updateSubscriptionSchema } from "./admin";

describe("onboardGymSchema", () => {
  const ok = {
    gymName: "Iron Paradise", ownerFullName: "Asha Rao",
    email: "asha@example.com", password: "secret12",
    plan: "professional", periodEnd: "2026-12-31",
  };

  it("accepts a valid payload", () => {
    expect(onboardGymSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects a short password", () => {
    expect(onboardGymSchema.safeParse({ ...ok, password: "short" }).success).toBe(false);
  });

  it("rejects a bad email", () => {
    expect(onboardGymSchema.safeParse({ ...ok, email: "nope" }).success).toBe(false);
  });

  it("rejects an unknown plan", () => {
    expect(onboardGymSchema.safeParse({ ...ok, plan: "gold" }).success).toBe(false);
  });
});

describe("updateSubscriptionSchema", () => {
  it("accepts a valid update", () => {
    const r = updateSubscriptionSchema.safeParse({
      plan: "starter", status: "active", periodEnd: "2027-01-01",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(updateSubscriptionSchema.safeParse({
      plan: "starter", status: "frozen", periodEnd: "2027-01-01",
    }).success).toBe(false);
  });
});
