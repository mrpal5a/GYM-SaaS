import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/members/metrics";
import { subscriptionExpiryStatus, type ExpiryStatus } from "@/lib/admin/expiry";

const META: Record<ExpiryStatus, { label: string; tone: "success" | "warning" | "danger" | "muted" }> = {
  active: { label: "Active", tone: "success" },
  expiring_soon: { label: "Expiring soon", tone: "warning" },
  expired: { label: "Expired", tone: "danger" },
  none: { label: "No expiry", tone: "muted" },
};

export function ExpiryBadge({ periodEnd }: { periodEnd: string | null }) {
  const status = subscriptionExpiryStatus(periodEnd);
  const meta = META[status];
  return (
    <span className="inline-flex items-center gap-2">
      <Badge tone={meta.tone}>{meta.label}</Badge>
      {periodEnd && <span className="text-xs text-muted-foreground">{formatDate(periodEnd)}</span>}
    </span>
  );
}
