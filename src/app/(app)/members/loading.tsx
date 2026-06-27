import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";
import { TableSkeleton } from "@/components/skeletons/table-skeleton";

export default function MembersLoading() {
  return (
    <div className="space-y-4">
      <PageHeaderSkeleton action />
      {/* search + status filter toolbar */}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-full max-w-xs rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <TableSkeleton columns={6} rows={8} />
    </div>
  );
}
