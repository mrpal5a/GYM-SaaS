import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the standard page header (title + subtitle), with an optional
 * action button on the right (e.g. the "Add member" button on /members).
 */
export function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
      {action && <Skeleton className="h-8 w-32 rounded-lg" />}
    </div>
  );
}
