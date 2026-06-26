import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FormSkeleton } from "@/components/skeletons/form-skeleton";

export default function EditMemberLoading() {
  return (
    <div className="space-y-4">
      {/* back link */}
      <Skeleton className="h-4 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-60" />
      </div>
      <Card className="glass">
        <CardContent>
          <FormSkeleton fields={7} />
        </CardContent>
      </Card>
    </div>
  );
}
