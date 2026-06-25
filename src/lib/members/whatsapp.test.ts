import { describe, it, expect } from "vitest";
import { normalizePhone, buildRenewalMessage, buildWhatsAppLink } from "./whatsapp";

describe("normalizePhone", () => {
  it("returns null for empty/unusable input", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
  });
  it("prepends the default country code to a bare 10-digit number", () => {
    expect(normalizePhone("9876543210")).toBe("919876543210");
    expect(normalizePhone("98765 43210")).toBe("919876543210");
  });
  it("drops a leading trunk zero", () => {
    expect(normalizePhone("09876543210")).toBe("919876543210");
  });
  it("keeps an already country-coded number and strips formatting", () => {
    expect(normalizePhone("+91 98765-43210")).toBe("919876543210");
    expect(normalizePhone("919876543210")).toBe("919876543210");
  });
});

describe("buildRenewalMessage", () => {
  it("uses the first name and the expiring wording", () => {
    const msg = buildRenewalMessage({
      memberName: "Rahul Sharma",
      planName: "Gold",
      gymName: "Iron Paradise",
      endDate: "2026-06-27",
      status: "expiring",
    });
    expect(msg).toContain("Hi Rahul,");
    expect(msg).toContain("Gold membership at Iron Paradise");
    expect(msg).toContain("is expiring on");
  });
  it("uses past-tense wording when expired", () => {
    const msg = buildRenewalMessage({
      memberName: "Priya",
      planName: "Basic",
      gymName: "Iron Paradise",
      endDate: "2026-06-01",
      status: "expired",
    });
    expect(msg).toContain("expired on");
  });
});

describe("buildWhatsAppLink", () => {
  it("returns null when the phone can't be normalized", () => {
    expect(buildWhatsAppLink("nope", "hi")).toBeNull();
  });
  it("builds a wa.me link with an encoded message", () => {
    const link = buildWhatsAppLink("9876543210", "Hi Rahul, renew now! 💪");
    expect(link).toContain("https://wa.me/919876543210?text=");
    expect(link).toContain("Hi%20Rahul");
    expect(link).not.toContain(" ");
  });
});
