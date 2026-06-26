"use client";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { CopyIcon, DownloadIcon, CheckIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOnboardingSettingsAction } from "@/actions/gym";

export function OnboardingSettings({
  joinUrl,
  joinQr,
  upiId,
  upiPayeeName,
}: {
  joinUrl: string;
  joinQr: string;
  upiId: string;
  upiPayeeName: string;
}) {
  const [state, action, pending] = useActionState(updateOnboardingSettingsAction, null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state?.ok) toast.success("Onboarding settings saved");
  }, [state]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={joinQr} alt="Join QR code" className="size-40 shrink-0 rounded-lg border bg-white p-2" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm text-muted-foreground">
            Print this QR at your front desk or share the link. New members scan it to register
            themselves — submissions land in <span className="font-medium text-foreground">Requests</span> for
            your approval.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={joinQr}
              download="join-qr.png"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <DownloadIcon /> Download QR
            </a>
            <Button type="button" variant="outline" size="sm" onClick={copyLink}>
              {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
          <p className="rounded-md bg-muted/50 p-2 font-mono text-xs break-all text-muted-foreground">
            {joinUrl}
          </p>
        </div>
      </div>

      <form action={action} className="space-y-3 border-t border-border/40 pt-4">
        <p className="text-sm font-medium">UPI payment details</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="upi_id">UPI ID</Label>
            <Input id="upi_id" name="upi_id" placeholder="yourgym@okhdfc" defaultValue={upiId} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="upi_payee_name">Payee name</Label>
            <Input
              id="upi_payee_name"
              name="upi_payee_name"
              placeholder="Your Gym Pvt Ltd"
              defaultValue={upiPayeeName}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Shown on the join form so members can pay by UPI. Leave the UPI ID blank to offer Cash only.
        </p>
        {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save UPI details"}
        </Button>
      </form>
    </div>
  );
}
