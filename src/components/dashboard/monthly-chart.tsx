"use client";
import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyPoint } from "@/lib/dashboard/monthly-stats";
import { formatMoney } from "@/lib/members/metrics";

/** MonthlyPoint.key is `${year}-${monthIndex}` (0-based). The payments filter
 *  expects `YYYY-MM` (1-based, zero-padded), e.g. "2026-4" → "2026-05". */
function toMonthParam(key: string): string {
  const [year, monthIdx] = key.split("-").map(Number);
  return `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
}

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
      <p className="mt-2 text-xs text-muted-foreground">Click to view payments →</p>
    </div>
  );
}

// Each month keeps a readable column width; the chart scrolls horizontally when
// the months don't all fit (e.g. 12 months on a phone).
const PER_MONTH_PX = 64;

/** Revenue bars per month; hover any month for its full breakdown. Horizontally
 *  scrollable so every month stays readable regardless of how many there are. */
export function MonthlyChart({ data }: { data: MonthlyPoint[] }) {
  const router = useRouter();

  // Map a click's X position to its month and open that month's payments. We use
  // the plot geometry (the cartesian grid spans the evenly-spaced month bands)
  // rather than recharts' own click/hover events, which don't fire reliably here.
  function handleClick(e: MouseEvent<HTMLDivElement>) {
    const grid = e.currentTarget.querySelector(".recharts-cartesian-grid");
    const rect = grid?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    if (ratio < 0 || ratio > 1) return;
    const point = data[Math.min(data.length - 1, Math.floor(ratio * data.length))];
    if (point?.key) router.push(`/payments?month=${toMonthParam(point.key)}`);
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="h-64 cursor-pointer"
        style={{ minWidth: data.length * PER_MONTH_PX }}
        onClickCapture={handleClick}
      >
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
