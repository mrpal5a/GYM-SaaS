"use client";
import { useState } from "react";
import { toast } from "sonner";
import { MailIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendWeeklyBackupsAction } from "@/actions/admin";

/**
 * Super-admin "Email backups now" — runs the weekly gym-backup job on demand
 * (the same one the Monday cron runs) and reports a summary toast.
 */
export function SendBackupsButton() {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const res = await sendWeeklyBackupsAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const s = res.summary;
      const more = s.hasMore ? " · more remaining (scheduled job will finish)" : "";
      if (s.emailNotConfigured) {
        toast.error("Email isn't configured yet. Add RESEND_API_KEY to send backups.");
      } else if (s.sent > 0) {
        toast.success(
          `Backup emailed to ${s.sent} gym${s.sent === 1 ? "" : "s"}` +
            (s.skipped ? ` · ${s.skipped} skipped` : "") +
            (s.failed ? ` · ${s.failed} failed` : "") +
            more,
        );
      } else if (s.failed > 0) {
        toast.error(`Couldn't send ${s.failed} backup${s.failed === 1 ? "" : "s"}.`);
      } else if (s.alreadyDone > 0) {
        toast.info(`All gyms already backed up this week (${s.alreadyDone}).`);
      } else {
        toast.info("No gyms to back up.");
      }
    } catch {
      toast.error("Couldn't send backups. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={onClick} disabled={busy}>
      {busy ? <Loader2Icon className="animate-spin" /> : <MailIcon />}
      {busy ? "Sending…" : "Email backups now"}
    </Button>
  );
}
