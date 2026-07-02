import { UsersRoundIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { GroupRow } from "@/components/groups/group-row";
import type { MembershipStatus } from "@/types/db";

export const dynamic = "force-dynamic";

type GroupMember = {
  id: string;
  full_name: string;
  photo_url: string | null;
  plan_name: string | null;
  membership_status: MembershipStatus;
  group_id: string | null;
};

export default async function GroupsPage() {
  const supabase = await createClient();

  // All groups, plus every grouped member (one query), plus their payments — then
  // aggregate members + revenue per group in memory. RLS scopes all of it to the gym.
  const [{ data: groupsData }, { data: membersData }] = await Promise.all([
    supabase.from("member_groups").select("id, name").order("name"),
    supabase
      .from("member_with_status")
      .select("id, full_name, photo_url, plan_name, membership_status, group_id")
      .not("group_id", "is", null)
      .order("full_name"),
  ]);
  const groups = (groupsData ?? []) as { id: string; name: string }[];
  const members = (membersData ?? []) as GroupMember[];

  const memberIds = members.map((m) => m.id);
  let payments: { amount: number; member_id: string | null }[] = [];
  if (memberIds.length > 0) {
    const { data } = await supabase.from("payments").select("amount, member_id").in("member_id", memberIds);
    payments = (data ?? []) as { amount: number; member_id: string | null }[];
  }

  // group_id -> members, and member_id -> group_id (to attribute revenue).
  const membersByGroup = new Map<string, GroupMember[]>();
  const memberToGroup = new Map<string, string>();
  for (const m of members) {
    if (!m.group_id) continue;
    memberToGroup.set(m.id, m.group_id);
    const list = membersByGroup.get(m.group_id) ?? [];
    list.push(m);
    membersByGroup.set(m.group_id, list);
  }
  const revenueByGroup = new Map<string, number>();
  for (const p of payments) {
    const gid = p.member_id ? memberToGroup.get(p.member_id) : undefined;
    if (gid) revenueByGroup.set(gid, (revenueByGroup.get(gid) ?? 0) + Number(p.amount));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Groups</h1>
        <p className="text-sm text-muted-foreground">
          {groups.length} {groups.length === 1 ? "group" : "groups"} · friends and family who joined together
        </p>
      </div>

      {groups.length === 0 ? (
        <Card className="glass flex flex-col items-center gap-3 p-12 text-center">
          <UsersRoundIcon className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No groups yet</p>
            <p className="text-sm text-muted-foreground">
              Start a group from a member&apos;s page, or when adding a new member, to link people
              who joined together.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <GroupRow
              key={g.id}
              group={g}
              members={membersByGroup.get(g.id) ?? []}
              revenue={revenueByGroup.get(g.id) ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
