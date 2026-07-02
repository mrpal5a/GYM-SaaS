"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilIcon, Trash2Icon, CheckIcon, XIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MemberAvatar } from "@/components/members/member-avatar";
import { StatusBadge } from "@/components/members/status-badge";
import { formatMoney } from "@/lib/members/metrics";
import { renameGroupAction, deleteGroupAction } from "@/actions/groups";
import type { MembershipStatus } from "@/types/db";

type Member = {
  id: string;
  full_name: string;
  photo_url: string | null;
  plan_name: string | null;
  membership_status: MembershipStatus;
};

/**
 * One group on the Groups page: its members, count and total revenue, with inline
 * rename and a two-step delete (deleting only detaches members — it never removes
 * them). Two-step confirm avoids a native dialog, which would block automation.
 */
export function GroupRow({
  group,
  members,
  revenue,
}: {
  group: { id: string; name: string };
  members: Member[];
  revenue: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    setBusy(true);
    const res = await renameGroupAction(group.id, name);
    setBusy(false);
    if (res.ok) {
      toast.success("Group renamed");
      setEditing(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function remove() {
    setBusy(true);
    const res = await deleteGroupAction(group.id);
    setBusy(false);
    if (res.ok) {
      toast.success("Group deleted");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 max-w-56"
              autoFocus
            />
            <Button size="icon-sm" onClick={save} disabled={busy} aria-label="Save name">
              {busy ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                setName(group.name);
                setEditing(false);
              }}
              disabled={busy}
              aria-label="Cancel rename"
            >
              <XIcon />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{group.name}</h2>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Rename group"
            >
              <PencilIcon className="size-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            {members.length} {members.length === 1 ? "member" : "members"}
          </span>
          <span className="font-medium text-foreground">{formatMoney(revenue)}</span>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="destructive" onClick={remove} disabled={busy}>
                {busy ? <Loader2Icon className="animate-spin" /> : "Confirm"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Delete group"
            >
              <Trash2Icon className="size-4" />
            </button>
          )}
        </div>
      </div>

      {members.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {members.map((m) => (
            <Link
              key={m.id}
              href={`/members/${m.id}`}
              className="flex items-center gap-2.5 rounded-lg border border-border/60 p-2 transition-colors hover:bg-foreground/5"
            >
              <MemberAvatar name={m.full_name} photoUrl={m.photo_url} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{m.full_name}</div>
                <div className="truncate text-xs text-muted-foreground">{m.plan_name || "No plan"}</div>
              </div>
              <StatusBadge status={m.membership_status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
