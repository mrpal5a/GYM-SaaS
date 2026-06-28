"use client";
import { useActionState } from "react";
import { adminUpdateSubscriptionAction } from "@/actions/admin";
import type { Subscription } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function SubscriptionEditor({ gymId, sub }: { gymId: string; sub: Subscription | null }) {
  const action = adminUpdateSubscriptionAction.bind(null, gymId);
  const [state, formAction, pending] = useActionState(action, null);
  const periodEnd = sub?.current_period_end ? sub.current_period_end.slice(0, 10) : "";

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="plan">Plan</Label>
          <Select id="plan" name="plan" defaultValue={sub?.plan ?? "starter"}>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={sub?.status ?? "active"}>
            <option value="trialing">Trialing</option>
            <option value="active">Active</option>
            <option value="past_due">Past due</option>
            <option value="canceled">Canceled</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="periodEnd">Expiry date</Label>
          {/* Remount when the saved value changes (after revalidatePath) so this
              uncontrolled input re-initializes from the fresh default rather than
              mutating defaultValue in place — Base UI warns on the latter. The prop
              only changes on save, never mid-edit, so typing is never interrupted. */}
          <Input key={periodEnd} id="periodEnd" name="periodEnd" type="date" defaultValue={periodEnd} required />
        </div>
      </div>
      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.ok === true && <p className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</p>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save subscription"}</Button>
    </form>
  );
}
