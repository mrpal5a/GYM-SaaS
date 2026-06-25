import { describe, it, expect } from "vitest";
import { generateInvoiceNumber } from "./invoice";

describe("generateInvoiceNumber", () => {
  it("encodes the date and time as INV-DDMMYYYYHHMMSS", () => {
    // 25 Jun 2026, 17:23:45 (month is 0-indexed in the Date constructor)
    const d = new Date(2026, 5, 25, 17, 23, 45);
    expect(generateInvoiceNumber(d)).toBe("INV-25062026172345");
  });
  it("zero-pads single-digit day, month, and time parts", () => {
    // 5 Mar 2026, 09:04:07
    const d = new Date(2026, 2, 5, 9, 4, 7);
    expect(generateInvoiceNumber(d)).toBe("INV-05032026090407");
  });
});
