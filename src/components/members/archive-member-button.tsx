"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArchiveIcon, ArchiveRestoreIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { archiveMemberAction, restoreMemberAction } from "@/actions/members";

/**
 * Archive / restore control on a member's page. Archiving is reversible, so it uses
 * a lightweight two-step confirm (no destructive-password prompt like delete).
 */
export function ArchiveMemberButton({
  memberId,
  archived,
}: {
  memberId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

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

  if (archived) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => run(() => restoreMemberAction(memberId), "Member restored")}
      >
        {busy ? <Loader2Icon className="animate-spin" /> : <ArchiveRestoreIcon />} Restore
      </Button>
    );
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="destructive"
          size="sm"
          disabled={busy}
          onClick={() => run(() => archiveMemberAction(memberId), "Member archived")}
        >
          {busy ? <Loader2Icon className="animate-spin" /> : null} Confirm archive
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirm(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={() => setConfirm(true)}>
      <ArchiveIcon /> Move to archive
    </Button>
  );
}
