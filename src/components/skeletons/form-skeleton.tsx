import { Skeleton } from "@/components/ui/skeleton";

/** Generic form placeholder: label + input rows followed by a submit button. */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-8 w-28 rounded-lg" />
    </div>
  );
}
