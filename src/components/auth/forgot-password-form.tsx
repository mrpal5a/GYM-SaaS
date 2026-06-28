"use client";
import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2Icon } from "lucide-react";
import { requestPasswordResetAction } from "@/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, null);

  if (state?.ok) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2Icon className="mx-auto size-10 text-emerald-500" />
        <p className="text-sm text-muted-foreground">
          If an account exists for that email, we&apos;ve sent a password-reset link. Check your inbox
          (and spam) — the link expires in about an hour.
        </p>
        <Link href="/login" className="text-sm text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-muted-foreground hover:text-foreground">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
