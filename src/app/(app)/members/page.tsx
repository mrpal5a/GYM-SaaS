import Link from "next/link";
import { UserPlusIcon, UsersIcon, UsersRoundIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { MembersToolbar } from "@/components/members/members-toolbar";
import { MemberAvatar } from "@/components/members/member-avatar";
import { StatusBadge } from "@/components/members/status-badge";
import { FlashToast } from "@/components/members/flash-toast";
import { formatDate, formatSerial } from "@/lib/members/metrics";
import type { MemberWithStatus } from "@/types/db";

export const dynamic = "force-dynamic";

// Sort options → the column + direction applied to the query.
const MEMBER_SORT_COLUMNS: Record<string, { column: string; ascending: boolean }> = {
  created_desc: { column: "created_at", ascending: false },
  created_asc: { column: "created_at", ascending: true },
  name_asc: { column: "full_name", ascending: true },
  name_desc: { column: "full_name", ascending: false },
};

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; flash?: string }>;
}) {
  const { q = "", status = "", sort = "", flash } = await searchParams;
  const supabase = await createClient();

  // Fall back to newest-first for anything unrecognized.
  const selectedSort = MEMBER_SORT_COLUMNS[sort] ? sort : "created_desc";
  const sortConfig = MEMBER_SORT_COLUMNS[selectedSort];

  let query = supabase
    .from("member_with_status")
    .select("*")
    // Archived (left-the-gym) members live on their own /archived page.
    .is("archived_at", null)
    .order(sortConfig.column, { ascending: sortConfig.ascending })
    .limit(500);

  const term = q.replace(/[%,()]/g, "").trim();
  if (term) {
    query = query.or(
      `full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`,
    );
  }
  // `status` may be a single value ("active") or a comma-separated list
  // ("active,expiring") when linked from a dashboard KPI that groups statuses.
  const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
  if (statuses.length === 1) query = query.eq("membership_status", statuses[0]);
  else if (statuses.length > 1) query = query.in("membership_status", statuses);

  const { data, error } = await query;
  const members = (data ?? []) as MemberWithStatus[];

  return (
    <div className="space-y-4">
      <FlashToast message={flash} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">
            {members.length} {members.length === 1 ? "member" : "members"}
            {(term || status) && " match your filters"}
          </p>
        </div>
        <Link href="/members/new" className={buttonVariants()}>
          <UserPlusIcon /> Add member
        </Link>
      </div>

      <MembersToolbar initialQuery={q} initialStatus={status} initialSort={selectedSort} />

      {error ? (
        <Card className="glass p-6 text-sm text-destructive">
          Couldn&apos;t load members: {error.message}
        </Card>
      ) : members.length === 0 ? (
        <Card className="glass flex flex-col items-center gap-3 p-12 text-center">
          <UsersIcon className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No members yet</p>
            <p className="text-sm text-muted-foreground">
              {term || status
                ? "Try clearing your search or filters."
                : "Add your first member to get started."}
            </p>
          </div>
          {!term && !status && (
            <Link href="/members/new" className={buttonVariants({ variant: "outline" })}>
              <UserPlusIcon /> Add member
            </Link>
          )}
        </Card>
      ) : (
        <Card className="glass overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-border/40 transition-colors last:border-0 hover:bg-foreground/[0.03]"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {formatSerial(m.serial)}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/members/${m.id}`} className="flex items-center gap-3">
                        <MemberAvatar name={m.full_name} photoUrl={m.photo_url} size="sm" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{m.full_name}</span>
                            {m.group_name && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                <UsersRoundIcon className="size-2.5" />
                                {m.group_name}
                              </span>
                            )}
                          </div>
                          {!m.is_active && (
                            <div className="text-xs text-muted-foreground">Inactive</div>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.phone || m.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.plan_name || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={m.membership_status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(m.end_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
