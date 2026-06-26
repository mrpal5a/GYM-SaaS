import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";
import { TableSkeleton } from "@/components/skeletons/table-skeleton";

/**
 * Generic fallback for any (app) route without its own loading.tsx
 * (e.g. /admin, /invoice/[paymentId]). Route-specific loaders override this.
 */
export default function AppLoading() {
  return (
    <div className="space-y-4">
      <PageHeaderSkeleton />
      <TableSkeleton columns={5} rows={8} />
    </div>
  );
}
