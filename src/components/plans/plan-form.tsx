"use client";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createPlanAction } from "@/actions/plans";

export function PlanForm() {
  const [state, action, pending] = useActionState(createPlanAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Plan created");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="kind">Plan type</Label>
        <Select id="kind" name="kind" defaultValue="membership">
          <option value="membership">Membership</option>
          <option value="personal_trainer">Personal Trainer</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Plan name</Label>
        <Input id="name" name="name" required placeholder="e.g. Monthly" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="price">Price</Label>
          <Input id="price" name="price" type="number" step="0.01" min="0" required placeholder="0.00" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="duration_days">Duration (days)</Label>
          <Input id="duration_days" name="duration_days" type="number" min="1" required placeholder="30" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={2} placeholder="Optional" />
      </div>
      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create plan"}
      </Button>
    </form>
  );
}
