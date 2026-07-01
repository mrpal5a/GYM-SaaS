"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UserPlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MemberAvatar } from "@/components/members/member-avatar";
import { inviteStaffAction, removeStaffAction } from "@/actions/auth";

export interface StaffRow {
  id: string;
  full_name: string | null;
  email: string;
  role: "gym_owner" | "staff" | "super_admin";
}

export function StaffManager({ people, selfId }: { people: StaffRow[]; selfId: string }) {
  const [state, action, pending] = useActionState(inviteStaffAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Invitation sent. They'll get an email to set a password and join.");
      formRef.current?.reset();
    } else if (state && state.ok === false) {
      toast.error(state.error);
    }
  }, [state]);

  async function onRemove(person: StaffRow) {
    if (!confirm(`Remove ${person.full_name || person.email}? They'll lose access immediately.`)) return;
    setRemovingId(person.id);
    try {
      const res = await removeStaffAction(person.id);
      if (res.ok) toast.success("Staff member removed.");
      else toast.error(res.error);
    } catch {
      toast.error("Couldn't remove them. Please try again.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Invite */}
      <form ref={formRef} action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label htmlFor="staff-email" className="text-sm font-medium">
            Invite staff by email
          </label>
          <Input
            id="staff-email"
            name="email"
            type="email"
            required
            placeholder="staff@example.com"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <UserPlusIcon />}
          {pending ? "Sending…" : "Send invite"}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Staff can manage members, plans and payments. They can&apos;t change billing or invite others.
      </p>

      {/* Current people */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Team</p>
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
          {people.map((p) => {
            const isOwner = p.role !== "staff";
            return (
              <li key={p.id} className="flex items-center gap-3 p-3">
                <MemberAvatar name={p.full_name || p.email} photoUrl={null} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {p.full_name || "—"}
                    {p.id === selfId && <span className="text-muted-foreground"> (you)</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{p.email}</div>
                </div>
                <Badge tone={isOwner ? "primary" : "muted"}>{isOwner ? "Owner" : "Staff"}</Badge>
                {!isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(p)}
                    disabled={removingId === p.id}
                    className="text-destructive hover:text-destructive"
                  >
                    {removingId === p.id ? (
                      <Loader2Icon className="animate-spin" />
                    ) : (
                      <Trash2Icon />
                    )}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
