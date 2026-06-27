"use client";
import { useActionState } from "react";
import { adminCreateGymAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function OnboardGymForm() {
  const [state, action, pending] = useActionState(adminCreateGymAction, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="gymName">Gym name</Label>
          <Input id="gymName" name="gymName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ownerFullName">Owner name</Label>
          <Input id="ownerFullName" name="ownerFullName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Owner email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Initial password</Label>
          <Input id="password" name="password" type="text" minLength={8} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan">Plan</Label>
          <Select id="plan" name="plan" defaultValue="starter">
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="periodEnd">SaaS expiry date</Label>
          <Input id="periodEnd" name="periodEnd" type="date" required />
        </div>
      </div>
      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create gym & owner"}</Button>
    </form>
  );
}
