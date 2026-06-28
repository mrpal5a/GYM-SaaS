const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DEFAULT_MONTHS = 6;

export interface MonthlyPoint {
  /** `${year}-${monthIndex}` bucket key. */
  key: string;
  /** Short axis label, e.g. "Jun". */
  label: string;
  /** Tooltip title, e.g. "June 2026". */
  fullLabel: string;
  revenue: number;
  newMembers: number;
  expiring: number;
  payments: number;
}

export interface MonthlyStatsInput {
  payments: { paid_at: string; amount: number }[];
  members: { joined_at: string }[];
  subscriptions: { end_date: string | null }[];
}

/** Bucket key for a date string. Date-only strings ("YYYY-MM-DD") are read as local
 *  midnight so a calendar date never slips into the previous month in negative-offset
 *  zones; full ISO timestamps are parsed as-is. Returns null for empty/invalid input. */
function keyOf(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = dateStr.length <= 10 ? new Date(dateStr + "T00:00:00") : new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/**
 * Roll payments, members, and membership subscriptions into the last `months`
 * calendar months (oldest → newest), zero-filling empty months. Pure +
 * deterministic: inject `now` in tests. Data outside the window is ignored.
 */
export function buildMonthlyStats(
  input: MonthlyStatsInput,
  now: Date = new Date(),
  months: number = DEFAULT_MONTHS,
): MonthlyPoint[] {
  const buckets: MonthlyPoint[] = [];
  const byKey = new Map<string, MonthlyPoint>();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const point: MonthlyPoint = {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: SHORT_MONTHS[d.getMonth()],
      fullLabel: `${FULL_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      revenue: 0,
      newMembers: 0,
      expiring: 0,
      payments: 0,
    };
    buckets.push(point);
    byKey.set(point.key, point);
  }

  for (const p of input.payments) {
    const b = byKey.get(keyOf(p.paid_at) ?? "");
    if (b) {
      b.revenue += Number(p.amount) || 0;
      b.payments += 1;
    }
  }
  for (const m of input.members) {
    const b = byKey.get(keyOf(m.joined_at) ?? "");
    if (b) b.newMembers += 1;
  }
  for (const s of input.subscriptions) {
    const b = byKey.get(keyOf(s.end_date) ?? "");
    if (b) b.expiring += 1;
  }

  return buckets;
}
