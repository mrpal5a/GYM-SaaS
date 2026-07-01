"use client";
import { useState } from "react";
import { toast } from "sonner";
import { BellRingIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendRenewalRemindersAction } from "@/actions/reminders";

/**
 * Owner-facing "email reminders now" button. Runs the same idempotent engine the
 * daily cron uses, scoped to this gym, and reports a summary toast.
 */
export function SendRemindersButton() {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const res = await sendRenewalRemindersAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const s = res.summary;
      if (s.emailNotConfigured) {
        toast.error("Email isn't configured yet. Add RESEND_API_KEY to send reminders.");
      } else if (s.sent > 0) {
        toast.success(
          `Sent ${s.sent} reminder${s.sent === 1 ? "" : "s"}` +
            (s.skipped ? ` · ${s.skipped} already reminded` : "") +
            (s.failed ? ` · ${s.failed} failed` : ""),
        );
      } else if (s.skipped > 0) {
        toast.info(`Everyone due has already been reminded (${s.skipped}).`);
      } else if (s.failed > 0) {
        toast.error(`Couldn't send ${s.failed} reminder${s.failed === 1 ? "" : "s"}.`);
      } else {
        toast.info("No members are due for a reminder right now.");
      }
    } catch {
      toast.error("Couldn't send reminders. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={busy}>
      {busy ? <Loader2Icon className="animate-spin" /> : <BellRingIcon />}
      {busy ? "Sending…" : "Email reminders"}
    </Button>
  );
}
