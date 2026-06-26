// @vitest-environment node
import { vi, describe, it, expect } from "vitest";
import type { InvoiceData } from "./invoice-data";

// `invoice-pdf` imports `server-only`, which throws outside an RSC bundle; stub it
// so we can render in plain Node. (vitest hoists vi.mock above the imports.)
vi.mock("server-only", () => ({}));

const { renderInvoicePdf } = await import("./invoice-pdf");

const sample: InvoiceData = {
  paymentId: "11111111-1111-1111-1111-111111111111",
  gymId: "22222222-2222-2222-2222-222222222222",
  memberId: "33333333-3333-3333-3333-333333333333",
  invoiceNumber: "INV-25062026172345",
  date: "25 Jun 2026",
  gymName: "Iron Paradise",
  logoUrl: null,
  memberName: "Rahul Sharma",
  memberPhone: "+91 98765 43210",
  memberEmail: "rahul@example.com",
  amount: "₹1,500",
  lineItem: "Gold membership",
  planName: "Gold",
  validUntil: "25 Jul 2026",
  note: "Includes joining fee",
  methodLabel: "Cash",
};

describe("renderInvoicePdf", () => {
  it("renders a non-empty PDF buffer with a valid header", async () => {
    const buf = await renderInvoicePdf(sample);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }, 30_000);
});
