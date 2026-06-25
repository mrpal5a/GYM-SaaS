import { Badge } from "@/components/ui/badge";
import { MEMBERSHIP_STATUS_META } from "@/lib/members/metrics";
import type { MembershipStatus } from "@/types/db";

export function StatusBadge({ status }: { status: MembershipStatus }) {
  const meta = MEMBERSHIP_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
