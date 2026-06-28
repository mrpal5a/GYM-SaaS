// @vitest-environment node
import { vi, describe, it, expect } from "vitest";
import type { JoiningFormData } from "./joining-form-data";

vi.mock("server-only", () => ({}));

const { renderJoiningFormPdf } = await import("./joining-form-pdf");

const base: JoiningFormData = {
  gymName: "Iron Paradise",
  logoUrl: null,
  gymAddress: "12 MG Road, Bengaluru 560038",
  rules: ["Always carry a towel.", "Wear gym shoes only."],
  member: {
    fullName: "Rahul Sharma",
    serial: "#0007",
    photoUrl: null,
    gender: "Male",
    dateOfBirth: "01 Jan 1995",
    phone: "+91 98765 43210",
    emergencyPhone: "+91 91234 56780",
    email: "rahul@example.com",
    address: "5th Cross, Indiranagar",
    height: "175 cm",
    weight: "72 kg",
    joinedAt: "25 Jun 2026",
  },
  membership: {
    planName: "Gold",
    startDate: "25 Jun 2026",
    endDate: "25 Jul 2026",
    status: "Active",
  },
};

describe("renderJoiningFormPdf", () => {
  it("renders a valid non-empty PDF", async () => {
    const buf = await renderJoiningFormPdf(base);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }, 30_000);

  it("renders when there is no membership and no rules", async () => {
    const buf = await renderJoiningFormPdf({ ...base, membership: null, rules: [] });
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }, 30_000);
});
