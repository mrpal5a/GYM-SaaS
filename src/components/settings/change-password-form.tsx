"use client";
import { useActionState, useEffect, useRef } from "react";
import { changePasswordAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields after a successful change so passwords aren't left on screen.
  useEffect(() => {
    if (state?.ok === true) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="newPassword">New password</Label>
          <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
        </div>
      </div>
      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.ok === true && <p className="text-sm text-emerald-600 dark:text-emerald-400">Password updated.</p>}
      <Button type="submit" disabled={pending}>{pending ? "Updating…" : "Update password"}</Button>
    </form>
  );
}
