import { describe, it, expect } from "vitest";
import { gymBrandingSchema, gymRulesSchema } from "./gym";

describe("gymBrandingSchema address", () => {
  it("accepts and trims an address", () => {
    const r = gymBrandingSchema.safeParse({ name: "Iron Paradise", address: "  12 MG Road  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.address).toBe("12 MG Road");
  });

  it("turns a blank address into undefined", () => {
    const r = gymBrandingSchema.safeParse({ name: "Iron Paradise", address: "   " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.address).toBeUndefined();
  });
});

describe("gymRulesSchema", () => {
  it("drops blank rules and trims the rest", () => {
    const r = gymRulesSchema.safeParse(["  Towel  ", "", "   ", "Gym shoes"]);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual(["Towel", "Gym shoes"]);
  });

  it("rejects more than 30 rules", () => {
    const many = Array.from({ length: 31 }, (_, i) => `Rule ${i}`);
    expect(gymRulesSchema.safeParse(many).success).toBe(false);
  });

  it("accepts an empty list", () => {
    const r = gymRulesSchema.safeParse([]);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual([]);
  });
});
