"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MemberAvatar } from "@/components/members/member-avatar";
import type { Member } from "@/types/db";

type ActionResult = { ok: false; error: string } | { ok: true };
type FormAction = (prev: unknown, formData: FormData) => Promise<ActionResult>;

export function MemberForm({
  action,
  member,
  submitLabel = "Save member",
}: {
  action: FormAction;
  member?: Member;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [preview, setPreview] = useState<string | null>(member?.photo_url ?? null);

  return (
    <form action={formAction} className="space-y-5">
      <div className="flex items-center gap-4">
        <MemberAvatar name={member?.full_name ?? "New"} photoUrl={preview} size="lg" />
        <div className="space-y-1.5">
          <Label htmlFor="photo">Photo</Label>
          <Input
            id="photo"
            name="photo"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : member?.photo_url ?? null);
            }}
          />
          <p className="text-xs text-muted-foreground">JPG/PNG up to 5 MB. Optional.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="full_name" required>
          <Input id="full_name" name="full_name" required defaultValue={member?.full_name ?? ""} />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={member?.phone ?? ""} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={member?.email ?? ""} />
        </Field>
        <Field label="Gender" htmlFor="gender">
          <Select id="gender" name="gender" defaultValue={member?.gender ?? ""}>
            <option value="">Not specified</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Date of birth" htmlFor="date_of_birth">
          <Input id="date_of_birth" name="date_of_birth" type="date" defaultValue={member?.date_of_birth ?? ""} />
        </Field>
        <Field label="Joined on" htmlFor="joined_at">
          <Input id="joined_at" name="joined_at" type="date" defaultValue={member?.joined_at ?? ""} />
        </Field>
        <Field label="Height (cm)" htmlFor="height_cm">
          <Input id="height_cm" name="height_cm" type="number" step="0.1" min="0" defaultValue={member?.height_cm ?? ""} />
        </Field>
        <Field label="Weight (kg)" htmlFor="weight_kg">
          <Input id="weight_kg" name="weight_kg" type="number" step="0.1" min="0" defaultValue={member?.weight_kg ?? ""} />
        </Field>
      </div>

      <Field label="Address" htmlFor="address">
        <Textarea id="address" name="address" rows={2} defaultValue={member?.address ?? ""} />
      </Field>
      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={3} defaultValue={member?.notes ?? ""} />
      </Field>

      {state?.ok === false && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Link
          href={member ? `/members/${member.id}` : "/members"}
          className={buttonVariants({ variant: "ghost" })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
