"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyPoint } from "@/lib/dashboard/monthly-stats";
import { formatMoney } from "@/lib/members/metrics";

/** Compact ₹ for the Y axis so "₹48,000" doesn't crowd the chart (e.g. ₹48k). */
function axisMoney(v: number): string {
  if (v >= 100000) return `₹${(v / 100000).toFixed(v % 100000 ? 1 : 0)}L`;
  if (v >= 1000) return `₹${Math.round(v / 1000)}k`;
  return `₹${v}`;
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function MonthTooltip({ active, payload }: { active?: boolean; payload?: { payload: MonthlyPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover/95 p-3 text-sm text-popover-foreground shadow-lg backdrop-blur">
      <p className="mb-2 font-semibold">{p.fullLabel}</p>
      <div className="space-y-1">
        <TooltipRow label="Revenue" value={formatMoney(p.revenue)} />
        <TooltipRow label="New members" value={String(p.newMembers)} />
        <TooltipRow label="Expiring" value={String(p.expiring)} />
        <TooltipRow label="Payments" value={String(p.payments)} />
      </div>
    </div>
  );
}

// Each month keeps a readable column width; the chart scrolls horizontally when
// the months don't all fit (e.g. 12 months on a phone).
const PER_MONTH_PX = 64;

/** Revenue bars per month; hover any month for its full breakdown. Horizontally
 *  scrollable so every month stays readable regardless of how many there are. */
export function MonthlyChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="h-64" style={{ minWidth: data.length * PER_MONTH_PX }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
          />
          <YAxis
            tickFormatter={axisMoney}
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          />
          <Tooltip
            cursor={{ fill: "var(--color-muted)", opacity: 0.35 }}
            content={<MonthTooltip />}
          />
          <Bar dataKey="revenue" fill="var(--color-primary)" radius={[6, 6, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
