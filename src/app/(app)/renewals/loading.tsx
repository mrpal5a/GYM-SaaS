import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";
import { StatCardsSkeleton } from "@/components/skeletons/stat-cards-skeleton";
import { TableSkeleton } from "@/components/skeletons/table-skeleton";

export default function RenewalsLoading() {
  return (
    <div className="space-y-4">
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={3} className="grid gap-4 sm:grid-cols-3" />
      <TableSkeleton columns={5} rows={6} />
    </div>
  );
}
