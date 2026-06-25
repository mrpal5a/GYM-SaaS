import { formatMoney } from "@/lib/members/metrics";

export interface RevenuePoint {
  label: string;
  value: number;
}

// Pure CSS bar chart — no client JS. Bars scale to the tallest month.
export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-48 items-end gap-3">
      {data.map((d) => {
        const pct = Math.round((d.value / max) * 100);
        return (
          <div key={d.label} className="group flex flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-md bg-primary/80 transition-all group-hover:bg-primary"
                style={{ height: `${Math.max(pct, 2)}%` }}
                title={formatMoney(d.value)}
              />
            </div>
            <span className="text-xs text-muted-foreground">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
