"use client";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { recordPaymentAction } from "@/actions/payments";

const today = () => new Date().toISOString().slice(0, 10);

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
];

export function RecordPaymentForm({
  memberId,
  members,
  compact,
}: {
  // Fixed member (member detail), or a picker (payments page).
  memberId?: string;
  members?: { id: string; full_name: string }[];
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(recordPaymentAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Payment recorded");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      {memberId ? (
        <input type="hidden" name="member_id" value={memberId} />
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="member_id">Member</Label>
          <Select id="member_id" name="member_id" required defaultValue="">
            <option value="" disabled>
              Choose a member…
            </option>
            {(members ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className={compact ? "space-y-3" : "grid gap-3 sm:grid-cols-2"}>
        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" name="amount" type="number" step="0.01" min="0" required placeholder="0.00" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="method">Method</Label>
          <Select id="method" name="method" defaultValue="cash">
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="paid_at">Date</Label>
        <Input id="paid_at" name="paid_at" type="date" defaultValue={today()} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="note">Note</Label>
        <Textarea id="note" name="note" rows={2} placeholder="Optional" />
      </div>

      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Recording…" : "Record payment"}
      </Button>
    </form>
  );
}
