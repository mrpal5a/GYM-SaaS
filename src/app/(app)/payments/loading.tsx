import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";
import { TableSkeleton } from "@/components/skeletons/table-skeleton";
import { FormSkeleton } from "@/components/skeletons/form-skeleton";

export default function PaymentsLoading() {
  return (
    <div className="space-y-4">
      <PageHeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TableSkeleton columns={6} rows={8} withAvatar={false} />
        </div>
        <Card className="glass h-fit">
          <CardHeader>
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <FormSkeleton fields={4} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
