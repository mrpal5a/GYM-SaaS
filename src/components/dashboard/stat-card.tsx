import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  /** When set, the whole card becomes a link to the underlying data. */
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : href ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
          View <ArrowRightIcon className="size-3" />
        </p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="group block">
        <Card className="glass p-5 transition-colors hover:bg-foreground/[0.03]">{body}</Card>
      </Link>
    );
  }

  return <Card className="glass p-5">{body}</Card>;
}
