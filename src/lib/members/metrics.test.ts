import { describe, it, expect } from "vitest";
import { calcBmi, daysUntil } from "./metrics";

describe("calcBmi", () => {
  it("returns null when height or weight is missing", () => {
    expect(calcBmi(null, 70)).toBeNull();
    expect(calcBmi(180, null)).toBeNull();
    expect(calcBmi(0, 70)).toBeNull();
  });
  it("computes BMI and category", () => {
    // 1.80m, 81kg -> 25.0 -> Overweight
    expect(calcBmi(180, 81)).toEqual({ value: 25, category: "Overweight" });
    // 1.70m, 60kg -> 20.8 -> Normal
    expect(calcBmi(170, 60)).toEqual({ value: 20.8, category: "Normal" });
    // 1.80m, 50kg -> 15.4 -> Underweight
    expect(calcBmi(180, 50)?.category).toBe("Underweight");
    // 1.60m, 90kg -> 35.2 -> Obese
    expect(calcBmi(160, 90)?.category).toBe("Obese");
  });
});

describe("daysUntil", () => {
  it("returns null for missing date", () => {
    expect(daysUntil(null)).toBeNull();
  });
  it("returns 0 for today", () => {
    // Build today's date in LOCAL time — daysUntil parses date strings as local
    // midnight, so a UTC-derived string flakes when the UTC date != the local date.
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(daysUntil(today)).toBe(0);
  });
});
