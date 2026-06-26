import { describe, it, expect } from "vitest";
import {
  generateInvoiceNumber,
  buildInvoiceShareText,
  buildWelcomeMessage,
  methodLabel,
} from "./invoice";

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

describe("methodLabel", () => {
  it("special-cases bank_transfer and capitalizes the rest", () => {
    expect(methodLabel("bank_transfer")).toBe("Bank transfer");
    expect(methodLabel("cash")).toBe("Cash");
    expect(methodLabel("upi")).toBe("Upi");
  });
});

describe("buildInvoiceShareText", () => {
  const base = {
    memberName: "Rahul Sharma",
    gymName: "Iron Paradise",
    amount: "₹1,500",
    invoiceNumber: "INV-25062026172345",
    date: "25 Jun 2026",
  };

  it("greets by first name and summarizes the payment", () => {
    const text = buildInvoiceShareText(base);
    expect(text).toContain("Hi Rahul,");
    expect(text).toContain("₹1,500");
    expect(text).toContain("Iron Paradise");
    expect(text).toContain("INV-25062026172345");
    expect(text).not.toContain("Download your invoice");
  });

  it("appends a PDF download link when one is provided (WhatsApp)", () => {
    const url = "https://x.supabase.co/storage/v1/object/public/invoices/g/p.pdf";
    const text = buildInvoiceShareText({ ...base, pdfUrl: url });
    expect(text).toContain(`Download your invoice: ${url}`);
  });
});

describe("buildWelcomeMessage", () => {
  const base = {
    memberName: "Rahul Sharma",
    gymName: "Iron Paradise",
    planName: "Gold",
    validUntil: "25 Jul 2026",
    amount: "₹1,500",
    invoiceNumber: "INV-25062026172345",
    date: "25 Jun 2026",
  };

  it("welcomes by first name and confirms plan, validity, and payment", () => {
    const text = buildWelcomeMessage(base);
    expect(text).toContain("welcome to Iron Paradise");
    expect(text).toContain("Hi Rahul,");
    expect(text).toContain("Gold membership is now active");
    expect(text).toContain("valid until 25 Jul 2026");
    expect(text).toContain("₹1,500");
    expect(text).toContain("INV-25062026172345");
    expect(text).not.toContain("Download your invoice");
  });

  it("omits the validity clause when there's no end date", () => {
    const text = buildWelcomeMessage({ ...base, validUntil: null });
    expect(text).not.toContain("valid until");
    expect(text).toContain("is now active.");
  });

  it("falls back to a generic 'membership' when the plan is unknown", () => {
    const text = buildWelcomeMessage({ ...base, planName: null });
    expect(text).toContain("Your membership is now active");
  });

  it("appends the invoice link for WhatsApp", () => {
    const url = "https://is.gd/abc123";
    const text = buildWelcomeMessage({ ...base, pdfUrl: url });
    expect(text).toContain(`Download your invoice: ${url}`);
  });
});
