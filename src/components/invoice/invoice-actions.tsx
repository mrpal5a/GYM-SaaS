"use client";
import { useState } from "react";
import { toast } from "sonner";
import { PrinterIcon, MessageCircleIcon, MailIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prepareInvoiceWhatsAppAction, sendInvoiceEmailAction } from "@/actions/invoice";

export function InvoiceActions({
  paymentId,
  hasPhone,
  hasEmail,
}: {
  paymentId: string;
  hasPhone: boolean;
  hasEmail: boolean;
}) {
  const [busy, setBusy] = useState<null | "whatsapp" | "email">(null);

  async function onWhatsApp() {
    setBusy("whatsapp");
    // Open the tab synchronously (within the click) so the eventual wa.me
    // navigation isn't treated as a blocked popup after the await.
    const win = window.open("about:blank", "_blank");
    try {
      const res = await prepareInvoiceWhatsAppAction(paymentId);
      if (res.ok) {
        if (win) win.location.href = res.url;
        else window.location.href = res.url;
      } else {
        win?.close();
        toast.error(res.error);
      }
    } catch {
      win?.close();
      toast.error("Couldn't prepare the WhatsApp message. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function onEmail() {
    setBusy("email");
    try {
      const res = await sendInvoiceEmailAction(paymentId);
      if (res.ok) toast.success("Invoice emailed to the member.");
      else toast.error(res.error);
    } catch {
      toast.error("Couldn't send the email. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button variant="default" size="sm" onClick={() => window.print()} disabled={busy !== null}>
        <PrinterIcon /> Print / Save PDF
      </Button>
      {hasPhone && (
        <Button variant="outline" size="sm" onClick={onWhatsApp} disabled={busy !== null}>
          {busy === "whatsapp" ? <Loader2Icon className="animate-spin" /> : <MessageCircleIcon />}
          {busy === "whatsapp" ? "Preparing…" : "WhatsApp"}
        </Button>
      )}
      {hasEmail && (
        <Button variant="outline" size="sm" onClick={onEmail} disabled={busy !== null}>
          {busy === "email" ? <Loader2Icon className="animate-spin" /> : <MailIcon />}
          {busy === "email" ? "Sending…" : "Email"}
        </Button>
      )}
    </div>
  );
}
