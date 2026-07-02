import Link from "next/link";
import { ArchiveIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getGymContext } from "@/lib/auth/context";
import { canManageGym } from "@/lib/auth/roles";
import { Card } from "@/components/ui/card";
import { MemberAvatar } from "@/components/members/member-avatar";
import { ArchiveMemberButton } from "@/components/members/archive-member-button";
import { SendWinbackButton } from "@/components/members/send-winback-button";
import { formatDate } from "@/lib/members/metrics";
import { WINBACK_MAX_MONTHS } from "@/lib/members/winback-content";
import type { MemberWithStatus } from "@/types/db";

export const dynamic = "force-dynamic";

type ArchivedRow = Pick<
  MemberWithStatus,
  "id" | "full_name" | "photo_url" | "phone" | "email" | "plan_name" | "archived_at"
>;

export default async function ArchivedPage() {
  const supabase = await createClient();
  const ctx = await getGymContext();
  const canManage = ctx ? canManageGym(ctx.role) : false;

  const { data } = await supabase
    .from("member_with_status")
    .select("id, full_name, photo_url, phone, email, plan_name, archived_at")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false })
    .limit(500);
  const rows = (data ?? []) as ArchivedRow[];

  // Most-recent successful win-back email per member, for the "Last sent" column.
  const lastWinback = new Map<string, string>();
  if (rows.length > 0) {
    const { data: sends } = await supabase
      .from("winback_emails")
      .select("member_id, sent_at")
      .eq("status", "sent")
      .in("member_id", rows.map((r) => r.id))
      .order("sent_at", { ascending: false });
    for (const s of (sends ?? []) as { member_id: string; sent_at: string }[]) {
      // Rows are newest-first, so keep the first (latest) seen per member.
      if (!lastWinback.has(s.member_id)) lastWinback.set(s.member_id, s.sent_at);
    }
  }

  // Members archived within the last N months still receive the monthly win-back email.
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - WINBACK_MAX_MONTHS);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Archived members</h1>
          <p className="text-sm text-muted-foreground">
            Members who left the gym. They&apos;re hidden from Members &amp; Renewals, and get a
            monthly win-back email for {WINBACK_MAX_MONTHS} months. Restore anyone who returns.
          </p>
        </div>
        {canManage && rows.length > 0 && <SendWinbackButton />}
      </div>

      {rows.length === 0 ? (
        <Card className="glass flex flex-col items-center gap-3 p-12 text-center">
          <ArchiveIcon className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No archived members</p>
            <p className="text-sm text-muted-foreground">
              When someone leaves the gym, use &ldquo;Move to archive&rdquo; on their page to keep
              your active lists clean.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="glass overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Last plan</th>
                  <th className="px-4 py-3 font-medium">Archived</th>
                  <th className="px-4 py-3 font-medium">Win-back</th>
                  <th className="px-4 py-3 font-medium">Last sent</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const active = m.archived_at ? new Date(m.archived_at) >= cutoff : false;
                  const emailable = active && !!m.email;
                  return (
                    <tr key={m.id} className="border-b border-border/40 last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/members/${m.id}`} className="flex items-center gap-3">
                          <MemberAvatar name={m.full_name} photoUrl={m.photo_url} size="sm" />
                          <span className="font-medium">{m.full_name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {m.phone || m.email || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{m.plan_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(m.archived_at)}</td>
                      <td className="px-4 py-3">
                        {!m.email ? (
                          <span className="text-xs text-muted-foreground">No email</span>
                        ) : emailable ? (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">Active</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Ended</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {lastWinback.has(m.id) ? formatDate(lastWinback.get(m.id)!) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <ArchiveMemberButton memberId={m.id} archived />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
