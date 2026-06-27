import ExcelJS from "exceljs";

export interface GymExportData {
  gym: { name: string; slug: string; created_at: string };
  subscription: { plan: string; status: string; current_period_end: string | null } | null;
  members: Array<{
    full_name: string; email: string | null; phone: string | null; gender: string | null;
    date_of_birth: string | null; joined_at: string; is_active: boolean; created_at: string;
  }>;
  plans: Array<{
    name: string; description: string | null; price: number; duration_days: number;
    is_active: boolean; created_at: string;
  }>;
  subscriptions: Array<{
    member_name: string | null; plan_name: string; start_date: string; end_date: string; status: string;
  }>;
  payments: Array<{
    member_name: string | null; amount: number; method: string;
    invoice_number: string | null; paid_at: string; note: string | null;
  }>;
}

function addSheet(
  wb: ExcelJS.Workbook,
  name: string,
  headers: string[],
  rows: Array<Array<string | number | boolean | null>>,
) {
  const ws = wb.addWorksheet(name);
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(r);
  ws.columns.forEach((c) => { c.width = 18; });
  return ws;
}

/** Build a multi-tab workbook of one gym's data. Pure — no IO. */
export function buildGymWorkbook(data: GymExportData): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();

  addSheet(wb, "Gym Info", ["Field", "Value"], [
    ["Name", data.gym.name],
    ["Slug", data.gym.slug],
    ["Created", data.gym.created_at],
    ["Plan", data.subscription?.plan ?? "—"],
    ["Status", data.subscription?.status ?? "—"],
    ["SaaS expiry", data.subscription?.current_period_end ?? "—"],
  ]);

  addSheet(wb, "Members",
    ["Full name", "Email", "Phone", "Gender", "Date of birth", "Joined", "Active", "Created"],
    data.members.map((m) => [
      m.full_name, m.email, m.phone, m.gender, m.date_of_birth, m.joined_at, m.is_active, m.created_at,
    ]),
  );

  addSheet(wb, "Plans",
    ["Name", "Description", "Price", "Duration (days)", "Active", "Created"],
    data.plans.map((p) => [p.name, p.description, p.price, p.duration_days, p.is_active, p.created_at]),
  );

  addSheet(wb, "Subscriptions",
    ["Member", "Plan", "Start", "End", "Status"],
    data.subscriptions.map((s) => [s.member_name, s.plan_name, s.start_date, s.end_date, s.status]),
  );

  addSheet(wb, "Payments",
    ["Member", "Amount", "Method", "Invoice #", "Paid at", "Note"],
    data.payments.map((p) => [p.member_name, p.amount, p.method, p.invoice_number, p.paid_at, p.note]),
  );

  return wb;
}
