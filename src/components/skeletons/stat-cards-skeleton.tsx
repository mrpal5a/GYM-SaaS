import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Row of stat-card placeholders matching <StatCard> (label + icon + big value).
 * `className` controls the grid (4-up on the dashboard, 3-up on renewals).
 */
export function StatCardsSkeleton({
  count = 4,
  className = "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="glass p-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-4 rounded" />
          </div>
          <Skeleton className="mt-3 h-8 w-20" />
        </Card>
      ))}
    </div>
  );
}
