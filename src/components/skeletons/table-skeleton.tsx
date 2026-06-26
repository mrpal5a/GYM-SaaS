import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * A glass-card table placeholder matching the members/payments/renewals tables.
 * Set `withAvatar` when the first column leads with an avatar (members, renewals).
 */
export function TableSkeleton({
  columns = 5,
  rows = 8,
  withAvatar = true,
}: {
  columns?: number;
  rows?: number;
  withAvatar?: boolean;
}) {
  return (
    <Card className="glass overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60">
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <Skeleton className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r} className="border-b border-border/40 last:border-0">
                {Array.from({ length: columns }).map((_, c) => (
                  <td key={c} className="px-4 py-3">
                    {withAvatar && c === 0 ? (
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-8 rounded-full" />
                        <Skeleton className="h-3.5 w-28" />
                      </div>
                    ) : (
                      <Skeleton className={cn("h-3.5", c === 0 ? "w-32" : "w-20")} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
