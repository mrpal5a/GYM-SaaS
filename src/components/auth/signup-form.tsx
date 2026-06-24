"use client";
import { useActionState } from "react";
import { signupAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, null);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="fullName">Your name</Label>
        <Input id="fullName" name="fullName" required /></div>
      <div className="space-y-2"><Label htmlFor="gymName">Gym name</Label>
        <Input id="gymName" name="gymName" required /></div>
      <div className="space-y-2"><Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required /></div>
      <div className="space-y-2"><Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required /></div>
      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating…" : "Create my gym"}
      </Button>
    </form>
  );
}
