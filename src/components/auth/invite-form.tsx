"use client";
import { useActionState } from "react";
import { acceptInviteAction } from "@/actions/accept-invite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export function InviteForm() {
  const [state, action, pending] = useActionState(acceptInviteAction, null);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="fullName">Your name</Label>
        <Input id="fullName" name="fullName" required /></div>
      <div className="space-y-2"><Label htmlFor="password">Set a password</Label>
        <PasswordInput id="password" name="password" autoComplete="new-password" required /></div>
      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Joining…" : "Join gym"}
      </Button>
    </form>
  );
}
