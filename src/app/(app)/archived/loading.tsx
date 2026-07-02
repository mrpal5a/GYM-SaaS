import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";
import { TableSkeleton } from "@/components/skeletons/table-skeleton";

export default function ArchivedLoading() {
  return (
    <div className="space-y-4">
      <PageHeaderSkeleton action />
      <TableSkeleton columns={6} rows={6} />
    </div>
  );
}
