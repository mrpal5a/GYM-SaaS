import { describe, it, expect } from "vitest";
import {
  generateInvoiceNumber,
  buildInvoiceShareText,
  buildWelcomeMessage,
  buildWelcomeEmail,
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

  it("includes the purpose, plan, and period when provided", () => {
    const text = buildInvoiceShareText({
      ...base,
      purpose: "Membership renewal",
      planName: "Monthly",
      period: "1 Jul 2026 – 1 Aug 2026",
    });
    expect(text).toContain("For: Membership renewal (Monthly) · 1 Jul 2026 – 1 Aug 2026");
  });

  it("omits the detail line when no purpose/plan/period is given", () => {
    expect(buildInvoiceShareText(base)).not.toContain("For:");
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

  it("shows the full period when provided, in place of 'valid until'", () => {
    const text = buildWelcomeMessage({ ...base, period: "25 Jun 2026 – 25 Jul 2026" });
    expect(text).toContain("is valid 25 Jun 2026 – 25 Jul 2026");
    expect(text).not.toContain("valid until");
  });
});

describe("buildWelcomeEmail", () => {
  const base = {
    memberName: "Rahul Sharma",
    gymName: "Iron Paradise",
    planName: "Gold",
    period: "25 Jun 2026 – 25 Jul 2026",
    validUntil: "25 Jul 2026",
    amount: "₹1,500",
    invoiceNumber: "INV-25062026172345",
    date: "25 Jun 2026",
    rules: ["Carry a towel", "Re-rack your weights"],
  };

  it("congratulates the member and includes plan details", () => {
    const { subject, text } = buildWelcomeEmail(base);
    expect(subject).toContain("Welcome to Iron Paradise");
    expect(text).toContain("Hi Rahul,");
    expect(text).toContain("Congratulations on becoming a member");
    expect(text).toContain("Gold membership");
    expect(text).toContain("25 Jun 2026 – 25 Jul 2026");
    expect(text).toContain("₹1,500");
    expect(text).toContain("INV-25062026172345");
  });

  it("lists the gym rules and mentions the attached invoice", () => {
    const { text, html } = buildWelcomeEmail(base);
    expect(text).toContain("1. Carry a towel");
    expect(text).toContain("2. Re-rack your weights");
    expect(text).toContain("invoice is attached");
    expect(html).toContain("<li");
  });

  it("omits the rules section when there are none", () => {
    const { text } = buildWelcomeEmail({ ...base, rules: [] });
    expect(text).not.toContain("gym rules");
  });
});
