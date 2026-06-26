import { Card, CardContent } from "@/components/ui/card";
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";
import { FormSkeleton } from "@/components/skeletons/form-skeleton";

export default function NewMemberLoading() {
  return (
    <div className="space-y-4">
      <PageHeaderSkeleton />
      <Card className="glass">
        <CardContent>
          <FormSkeleton fields={7} />
        </CardContent>
      </Card>
    </div>
  );
}
