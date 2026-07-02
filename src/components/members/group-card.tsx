"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UsersIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { MemberAvatar } from "@/components/members/member-avatar";
import { StatusBadge } from "@/components/members/status-badge";
import {
  createGroupForMemberAction,
  addMemberToGroupAction,
  removeMemberFromGroupAction,
} from "@/actions/groups";
import type { MembershipStatus } from "@/types/db";

type Groupmate = {
  id: string;
  full_name: string;
  photo_url: string | null;
  plan_name: string | null;
  membership_status: MembershipStatus;
};

/**
 * The "Group" card on a member's page: shows everyone who joined together, and lets
 * staff start a group, add existing (ungrouped) members to it, or remove this
 * member from it. A member belongs to at most one group.
 */
export function GroupCard({
  memberId,
  group,
  groupmates,
  candidates,
  existingGroups,
}: {
  memberId: string;
  group: { id: string; name: string } | null;
  groupmates: Groupmate[];
  candidates: { id: string; full_name: string }[];
  existingGroups: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [addId, setAddId] = useState("");
  const [joinId, setJoinId] = useState("");

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      toast.success(ok);
      router.refresh();
    } else {
      toast.error(res.error ?? "Something went wrong");
    }
  }

  return (
    <div className="space-y-3">
      {group ? (
        <>
          <div className="flex items-center gap-2 text-sm font-medium">
            <UsersIcon className="size-4 text-muted-foreground" />
            {group.name}
          </div>

          {groupmates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one else in this group yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {groupmates.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/members/${m.id}`}
                    className="flex items-center gap-2.5 rounded-lg border border-border/60 p-2 transition-colors hover:bg-foreground/5"
                  >
                    <MemberAvatar name={m.full_name} photoUrl={m.photo_url} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{m.full_name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {m.plan_name || "No plan"}
                      </div>
                    </div>
                    <StatusBadge status={m.membership_status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {candidates.length > 0 && (
            <div className="flex gap-2">
              <Select
                value={addId}
                onChange={(e) => setAddId(e.target.value)}
                aria-label="Add a member to this group"
              >
                <option value="">Add a member…</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !addId}
                onClick={() =>
                  run(() => addMemberToGroupAction(group.id, addId), "Added to group").then(() =>
                    setAddId(""),
                  )
                }
              >
                {busy ? <Loader2Icon className="animate-spin" /> : "Add"}
              </Button>
            </div>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={busy}
            onClick={() => run(() => removeMemberFromGroupAction(memberId), "Removed from group")}
          >
            Remove from group
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Not in a group.</p>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => run(() => createGroupForMemberAction(memberId), "Group started")}
          >
            {busy ? <Loader2Icon className="animate-spin" /> : <UsersIcon />} Start a group
          </Button>
          {existingGroups.length > 0 && (
            <div className="flex gap-2 border-t border-border/40 pt-3">
              <Select
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                aria-label="Add to an existing group"
              >
                <option value="">Add to existing group…</option>
                {existingGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !joinId}
                onClick={() =>
                  run(() => addMemberToGroupAction(joinId, memberId), "Added to group").then(() =>
                    setJoinId(""),
                  )
                }
              >
                {busy ? <Loader2Icon className="animate-spin" /> : "Add"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
