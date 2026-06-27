import { describe, it, expect } from "vitest";
import { DEFAULT_GYM_RULES } from "./default-rules";

describe("DEFAULT_GYM_RULES", () => {
  it("is a non-empty list of non-empty strings", () => {
    expect(Array.isArray(DEFAULT_GYM_RULES)).toBe(true);
    expect(DEFAULT_GYM_RULES.length).toBeGreaterThan(0);
    for (const rule of DEFAULT_GYM_RULES) {
      expect(typeof rule).toBe("string");
      expect(rule.trim().length).toBeGreaterThan(0);
    }
  });
});
