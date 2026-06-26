import { describe, it, expect } from "vitest";
import { joinRequestSchema } from "./join";

const valid = {
  full_name: "Rahul Sharma",
  phone: "9876543210",
  plan_id: "550e8400-e29b-41d4-a716-446655440000", // valid RFC-4122 v4 uuid
  payment_method: "cash",
};

describe("joinRequestSchema", () => {
  it("accepts a minimal valid submission", () => {
    expect(joinRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a name and a phone", () => {
    expect(joinRequestSchema.safeParse({ ...valid, full_name: "" }).success).toBe(false);
    expect(joinRequestSchema.safeParse({ ...valid, phone: "" }).success).toBe(false);
  });

  it("requires a valid plan id (uuid)", () => {
    expect(joinRequestSchema.safeParse({ ...valid, plan_id: "not-a-uuid" }).success).toBe(false);
  });

  it("only allows cash or upi as the payment method", () => {
    expect(joinRequestSchema.safeParse({ ...valid, payment_method: "card" }).success).toBe(false);
  });

  it("coerces optional numbers and drops blank optional fields", () => {
    const r = joinRequestSchema.safeParse({ ...valid, height_cm: "180", weight_kg: "", email: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.height_cm).toBe(180);
      expect(r.data.weight_kg).toBeUndefined();
      expect(r.data.email).toBeUndefined();
    }
  });
});
