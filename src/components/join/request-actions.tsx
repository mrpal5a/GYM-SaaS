"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, XIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { approveJoinRequestAction, rejectJoinRequestAction } from "@/actions/join";

export function RequestActions({
  requestId,
  groups = [],
}: {
  requestId: string;
  groups?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [groupChoice, setGroupChoice] = useState("");

  async function onApprove() {
    setBusy("approve");
    const res = await approveJoinRequestAction(requestId, groupChoice);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    const d = res.delivery;
    toast.success(
      d?.emailSent ? "Approved — member added & invoice emailed" : "Approved — member added",
    );
    // Member has an email but the send failed (e.g. Resend not configured yet).
    if (d?.emailError) toast.warning(d.emailError);
    // Click-to-chat can't auto-send; offer a one-tap button that opens WhatsApp
    // with the welcome message + invoice link pre-filled (the tap is the gesture
    // that keeps the popup from being blocked).
    if (d?.whatsappUrl) {
      const url = d.whatsappUrl;
      toast("Send the welcome message & invoice link on WhatsApp", {
        duration: 20000,
        action: { label: "Open WhatsApp", onClick: () => window.open(url, "_blank") },
      });
    }
    router.refresh();
  }

  async function onReject() {
    setBusy("reject");
    const res = await rejectJoinRequestAction(requestId, reason);
    setBusy(null);
    if (res.ok) {
      toast.success("Request rejected");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-2">
      <div>
        <Select
          value={groupChoice}
          onChange={(e) => setGroupChoice(e.target.value)}
          disabled={busy !== null}
          aria-label="Add to group on approval"
          className="sm:max-w-56"
        >
          <option value="">No group</option>
          <option value="__new__">＋ Start a new group (named after this member)</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onApprove} disabled={busy !== null}>
          {busy === "approve" ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowReject((s) => !s)}
          disabled={busy !== null}
        >
          <XIcon /> Reject
        </Button>
      </div>
      {showReject && (
        <div className="space-y-2 rounded-lg border border-border/60 p-3">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Reason (optional) — kept in the request record"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={onReject} disabled={busy !== null}>
              {busy === "reject" ? <Loader2Icon className="animate-spin" /> : null} Confirm reject
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowReject(false)}
              disabled={busy !== null}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
