"use client";
import * as React from "react";
import { useActionState, useEffect, useId, useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

type ActionResult = { ok: false; error: string } | { ok: true };

/**
 * A destructive-action trigger that opens a confirmation modal requiring the
 * signed-in user's password before the delete runs. The server action must accept
 * (prevState, formData), read a "password" field, and return an ActionResult so a
 * wrong password keeps the dialog open with an inline error. `hiddenFields` carries
 * the id(s) the action needs (e.g. memberId / planId).
 */
export function DeletePasswordDialog({
  action,
  hiddenFields,
  title,
  description,
  trigger,
  confirmLabel = "Delete",
}: {
  action: (prev: unknown, formData: FormData) => Promise<ActionResult>;
  hiddenFields: Record<string, string>;
  title: string;
  description: string;
  trigger: React.ReactElement;
  confirmLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, null);
  const passwordId = useId();

  // Close on success. (A redirecting action navigates away; an in-place delete
  // just dismisses the modal once the list has revalidated.) Reacting to the
  // async action result is exactly what this effect is for; the one-shot setState
  // can't cascade, so the set-state-in-effect heuristic is a false positive here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state?.ok === true) setOpen(false);
  }, [state]);

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger render={trigger} />
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity data-closed:opacity-0" />
        <AlertDialog.Popup className="glass fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border p-6 shadow-lg transition-all data-closed:scale-95 data-closed:opacity-0">
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-1 text-sm text-muted-foreground">
            {description}
          </AlertDialog.Description>
          <form action={formAction} className="mt-4 space-y-4">
            {Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <div className="space-y-2">
              <Label htmlFor={passwordId}>Enter your password to confirm</Label>
              <PasswordInput id={passwordId} name="password" autoComplete="current-password" required autoFocus />
            </div>
            {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
            <div className="flex justify-end gap-2">
              <AlertDialog.Close render={<Button type="button" variant="outline" size="sm" />}>
                Cancel
              </AlertDialog.Close>
              <Button type="submit" variant="destructive" size="sm" disabled={pending}>
                {pending ? "Deleting…" : confirmLabel}
              </Button>
            </div>
          </form>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
