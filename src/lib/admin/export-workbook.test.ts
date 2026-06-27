import { describe, it, expect } from "vitest";
import { buildGymWorkbook, type GymExportData } from "./export-workbook";

const data: GymExportData = {
  gym: { name: "Iron Paradise", slug: "iron-paradise-abc123", created_at: "2026-01-01T00:00:00Z" },
  subscription: { plan: "professional", status: "active", current_period_end: "2026-12-31T00:00:00Z" },
  members: [
    { full_name: "Asha Rao", email: "asha@example.com", phone: "999", gender: "female",
      date_of_birth: "1990-01-01", joined_at: "2026-01-02", is_active: true, created_at: "2026-01-02T00:00:00Z" },
  ],
  plans: [
    { name: "Monthly", description: null, price: 1000, duration_days: 30, is_active: true, created_at: "2026-01-01T00:00:00Z" },
  ],
  subscriptions: [
    { member_name: "Asha Rao", plan_name: "Monthly", start_date: "2026-01-02", end_date: "2026-02-01", status: "active" },
  ],
  payments: [
    { member_name: "Asha Rao", amount: 1000, method: "cash", invoice_number: "INV-1", paid_at: "2026-01-02T00:00:00Z", note: null },
  ],
};

describe("buildGymWorkbook", () => {
  it("creates the five expected sheets", () => {
    const wb = buildGymWorkbook(data);
    expect(wb.worksheets.map((w) => w.name)).toEqual(
      ["Gym Info", "Members", "Plans", "Subscriptions", "Payments"],
    );
  });

  it("writes a header row plus one data row in Members", () => {
    const wb = buildGymWorkbook(data);
    const ws = wb.getWorksheet("Members")!;
    expect(ws.getRow(1).getCell(1).value).toBe("Full name");
    expect(ws.getRow(2).getCell(1).value).toBe("Asha Rao");
    expect(ws.rowCount).toBe(2);
  });

  it("lists the payment amount", () => {
    const wb = buildGymWorkbook(data);
    const ws = wb.getWorksheet("Payments")!;
    expect(ws.getRow(2).getCell(2).value).toBe(1000);
  });
});
