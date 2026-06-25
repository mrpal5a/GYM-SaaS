"use client";
import { PrinterIcon, MessageCircleIcon, MailIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export function InvoiceActions({
  whatsappLink,
  emailHref,
}: {
  whatsappLink: string | null;
  emailHref: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button variant="default" size="sm" onClick={() => window.print()}>
        <PrinterIcon /> Print / Save PDF
      </Button>
      {whatsappLink && (
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <MessageCircleIcon /> WhatsApp
        </a>
      )}
      {emailHref && (
        <a href={emailHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <MailIcon /> Email
        </a>
      )}
    </div>
  );
}
