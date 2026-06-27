"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MemberAvatar } from "@/components/members/member-avatar";
import { formatMoney } from "@/lib/members/metrics";
import { compressImageToTarget } from "@/lib/images/resize";
import type { Member, MembershipPlan } from "@/types/db";

type ActionResult = { ok: false; error: string } | { ok: true };
type FormAction = (prev: unknown, formData: FormData) => Promise<ActionResult>;
type PlanOption = Pick<MembershipPlan, "id" | "name" | "price" | "duration_days">;

// Compress member photos to ~50 KB in the browser before upload (same budget as
// self-onboarding) so storage stays small at scale.
const PHOTO_TARGET = { maxBytes: 50_000, startDim: 512 };

const today = () => new Date().toISOString().slice(0, 10);

export function MemberForm({
  action,
  member,
  plans = [],
  trainerPlans = [],
  submitLabel = "Save member",
}: {
  action: FormAction;
  member?: Member;
  plans?: PlanOption[];
  trainerPlans?: PlanOption[];
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [preview, setPreview] = useState<string | null>(member?.photo_url ?? null);
  const [planId, setPlanId] = useState("");
  const [ptPlanId, setPtPlanId] = useState("");
  const [compressing, setCompressing] = useState(false);

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget; // capture before await
    if (!input.files?.[0]) {
      setPreview(member?.photo_url ?? null);
      return;
    }
    setCompressing(true);
    try {
      const compressed = await compressImageToTarget(input.files[0], PHOTO_TARGET);
      const dt = new DataTransfer();
      dt.items.add(compressed);
      input.files = dt.files;
      setPreview(URL.createObjectURL(compressed));
    } finally {
      setCompressing(false);
    }
  }

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
            onChange={onPickPhoto}
          />
          <p className="text-xs text-muted-foreground">JPG/PNG, optional — compressed automatically.</p>
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

      {!member && plans.length > 0 && (
        <div className="space-y-4 rounded-lg border border-border/60 p-4">
          <div>
            <p className="text-sm font-medium">Membership</p>
            <p className="text-xs text-muted-foreground">
              Optionally assign a plan now — you can also do it later from the member&apos;s page.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plan" htmlFor="plan_id">
              <Select
                id="plan_id"
                name="plan_id"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
              >
                <option value="">No plan yet</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatMoney(p.price)} / {p.duration_days}d
                  </option>
                ))}
              </Select>
            </Field>
            {planId && (
              <Field label="Start date" htmlFor="start_date">
                <Input id="start_date" name="start_date" type="date" defaultValue={today()} />
              </Field>
            )}
          </div>
          {planId && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="record_payment"
                className="size-4 accent-primary"
                defaultChecked
              />
              Record payment for the plan price
            </label>
          )}
        </div>
      )}

      {!member && trainerPlans.length > 0 && (
        <div className="space-y-4 rounded-lg border border-border/60 p-4">
          <div>
            <p className="text-sm font-medium">Personal Trainer</p>
            <p className="text-xs text-muted-foreground">
              Optional — assign a Personal Trainer plan if this member wants training
              alongside their membership.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Personal Trainer plan" htmlFor="pt_plan_id">
              <Select
                id="pt_plan_id"
                name="pt_plan_id"
                value={ptPlanId}
                onChange={(e) => setPtPlanId(e.target.value)}
              >
                <option value="">No trainer</option>
                {trainerPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatMoney(p.price)} / {p.duration_days}d
                  </option>
                ))}
              </Select>
            </Field>
            {ptPlanId && (
              <Field label="Start date" htmlFor="pt_start_date">
                <Input id="pt_start_date" name="pt_start_date" type="date" defaultValue={today()} />
              </Field>
            )}
          </div>
          {ptPlanId && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="record_pt_payment"
                className="size-4 accent-primary"
                defaultChecked
              />
              Record payment for the trainer plan price
            </label>
          )}
        </div>
      )}

      {state?.ok === false && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || compressing}>
          {compressing ? "Processing image…" : pending ? "Saving…" : submitLabel}
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
