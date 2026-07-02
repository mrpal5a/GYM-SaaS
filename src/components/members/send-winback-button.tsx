"use client";
import { useState } from "react";
import { toast } from "sonner";
import { MailIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendWinbackEmailsAction } from "@/actions/winback";

/**
 * Owner-facing "email win-back nudges now" button on the Archived page. Runs the
 * same idempotent engine the monthly cron uses, scoped to this gym, and reports a
 * summary toast. Sends once per member per calendar month.
 */
export function SendWinbackButton() {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const res = await sendWinbackEmailsAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const s = res.summary;
      if (s.emailNotConfigured) {
        toast.error("Email isn't configured yet. Add RESEND_API_KEY to send win-back emails.");
      } else if (s.sent > 0) {
        toast.success(
          `Sent ${s.sent} win-back email${s.sent === 1 ? "" : "s"}` +
            (s.skipped ? ` · ${s.skipped} already emailed this month` : "") +
            (s.failed ? ` · ${s.failed} failed` : ""),
        );
      } else if (s.skipped > 0) {
        toast.info(`Everyone eligible was already emailed this month (${s.skipped}).`);
      } else if (s.failed > 0) {
        toast.error(`Couldn't send ${s.failed} email${s.failed === 1 ? "" : "s"}.`);
      } else {
        toast.info("No archived members with an email are due a nudge right now.");
      }
    } catch {
      toast.error("Couldn't send win-back emails. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={busy}>
      {busy ? <Loader2Icon className="animate-spin" /> : <MailIcon />}
      {busy ? "Sending…" : "Send win-back emails"}
    </Button>
  );
}
