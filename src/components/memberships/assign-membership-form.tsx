"use client";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { assignMembershipAction } from "@/actions/memberships";
import { formatMoney } from "@/lib/members/metrics";
import type { MembershipPlan } from "@/types/db";

const today = () => new Date().toISOString().slice(0, 10);

export function AssignMembershipForm({
  memberId,
  plans,
}: {
  memberId: string;
  plans: Pick<MembershipPlan, "id" | "name" | "price" | "duration_days">[];
}) {
  const [state, action, pending] = useActionState(assignMembershipAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Membership assigned");
      formRef.current?.reset();
    }
  }, [state]);

  if (plans.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active plans yet. Create one on the{" "}
        <a href="/plans" className="underline">
          Plans
        </a>{" "}
        page first.
      </p>
    );
  }

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="member_id" value={memberId} />
      <div className="space-y-1.5">
        <Label htmlFor="plan_id">Plan</Label>
        <Select id="plan_id" name="plan_id" required defaultValue="">
          <option value="" disabled>
            Choose a plan…
          </option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {formatMoney(p.price)} / {p.duration_days}d
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="start_date">Start date</Label>
        <Input id="start_date" name="start_date" type="date" defaultValue={today()} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="record_payment" className="size-4 accent-primary" defaultChecked />
        Record payment for the plan price
      </label>
      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Assigning…" : "Assign membership"}
      </Button>
    </form>
  );
}
