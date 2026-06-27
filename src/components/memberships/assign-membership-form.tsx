"use client";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { assignMembershipAction, type ActionResult } from "@/actions/memberships";
import { formatMoney } from "@/lib/members/metrics";
import type { MembershipPlan } from "@/types/db";

const today = () => new Date().toISOString().slice(0, 10);

type FormAction = (prev: unknown, formData: FormData) => Promise<ActionResult>;

/**
 * Assigns a plan (membership by default) to a member. Reused for Personal Trainer
 * plans by passing `action={assignPersonalTrainerAction}` and matching labels.
 * `idPrefix` keeps input ids unique when two of these render on one page.
 */
export function AssignMembershipForm({
  memberId,
  plans,
  action = assignMembershipAction,
  idPrefix = "membership",
  planLabel = "Plan",
  submitLabel = "Assign membership",
  submittingLabel = "Assigning…",
  successMessage = "Membership assigned",
}: {
  memberId: string;
  plans: Pick<MembershipPlan, "id" | "name" | "price" | "duration_days">[];
  action?: FormAction;
  idPrefix?: string;
  planLabel?: string;
  submitLabel?: string;
  submittingLabel?: string;
  successMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      toast.success(successMessage);
      formRef.current?.reset();
    }
  }, [state, successMessage]);

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

  const planFieldId = `${idPrefix}_plan_id`;
  const startFieldId = `${idPrefix}_start_date`;

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="member_id" value={memberId} />
      <div className="space-y-1.5">
        <Label htmlFor={planFieldId}>{planLabel}</Label>
        <Select id={planFieldId} name="plan_id" required defaultValue="">
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
        <Label htmlFor={startFieldId}>Start date</Label>
        <Input id={startFieldId} name="start_date" type="date" defaultValue={today()} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="record_payment" className="size-4 accent-primary" defaultChecked />
        Record payment for the plan price
      </label>
      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? submittingLabel : submitLabel}
      </Button>
    </form>
  );
}
