"use client";
import { useActionState, useState } from "react";
import { CheckCircle2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MemberAvatar } from "@/components/members/member-avatar";
import { formatMoney } from "@/lib/members/metrics";
import { submitJoinRequestAction } from "@/actions/join";
import { compressImageToTarget } from "@/lib/images/resize";
import { cn } from "@/lib/utils";
import type { MembershipPlan } from "@/types/db";

type PlanOption = Pick<MembershipPlan, "id" | "name" | "price" | "duration_days" | "description">;

// Storage budgets — compressed in the browser before upload so the free 1 GB of
// Supabase storage stretches across thousands of members. Profile photos stay
// crisp at 512px; payment screenshots only need to be legible enough to verify.
const PHOTO_TARGET = { maxBytes: 50_000, startDim: 512 };
const PROOF_TARGET = { maxBytes: 20_000, startDim: 1000 };

/**
 * Compress the picked image to a byte budget, then swap it back into the file
 * input (via DataTransfer) so the native form submission carries the small file.
 * Returns an object URL for the preview.
 */
async function compressInto(
  input: HTMLInputElement,
  opts: { maxBytes: number; startDim: number },
): Promise<string | null> {
  const file = input.files?.[0];
  if (!file) return null;
  const compressed = await compressImageToTarget(file, opts);
  const dt = new DataTransfer();
  dt.items.add(compressed);
  input.files = dt.files;
  return URL.createObjectURL(compressed);
}

export function JoinForm({
  token,
  plans,
  trainerPlans = [],
  upiId,
  upiPayeeName,
  upiQrByCombo,
}: {
  token: string;
  plans: PlanOption[];
  trainerPlans?: PlanOption[];
  upiId: string | null;
  upiPayeeName: string;
  upiQrByCombo: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(
    submitJoinRequestAction.bind(null, token),
    null,
  );
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [planId, setPlanId] = useState("");
  const [ptPlanId, setPtPlanId] = useState("");
  const [method, setMethod] = useState<"" | "cash" | "upi">("");
  // Block submit while an image is still being compressed so the small file —
  // not the raw original — is the one that gets sent.
  const [compressing, setCompressing] = useState(false);

  async function onPickImage(
    e: React.ChangeEvent<HTMLInputElement>,
    opts: { maxBytes: number; startDim: number },
    setPreview: (v: string | null) => void,
  ) {
    const input = e.currentTarget; // capture before await (input may blur)
    setCompressing(true);
    try {
      setPreview(await compressInto(input, opts));
    } finally {
      setCompressing(false);
    }
  }

  if (state?.ok) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <CheckCircle2Icon className="mx-auto size-12 text-emerald-500" />
        <h2 className="mt-4 text-lg font-semibold">Request submitted!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Thanks for registering. The gym will review your details and get in touch shortly.
        </p>
      </div>
    );
  }

  const selectedPlan = plans.find((p) => p.id === planId) ?? null;
  const selectedPt = trainerPlans.find((p) => p.id === ptPlanId) ?? null;
  const total = (selectedPlan?.price ?? 0) + (selectedPt?.price ?? 0);
  const comboQr = upiQrByCombo[`${planId}|${ptPlanId}`];

  return (
    <form action={formAction} className="glass space-y-6 rounded-xl p-5 sm:p-6">
      {/* Photo */}
      <div className="flex items-center gap-4">
        <MemberAvatar name="New" photoUrl={photoPreview} size="lg" />
        <div className="space-y-1.5">
          <Label htmlFor="photo">Your photo</Label>
          <Input
            id="photo"
            name="photo"
            type="file"
            accept="image/*"
            onChange={(e) => onPickImage(e, PHOTO_TARGET, setPhotoPreview)}
          />
          <p className="text-xs text-muted-foreground">JPG/PNG, optional — we&apos;ll compress it automatically.</p>
        </div>
      </div>

      {/* Personal details */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="full_name" required>
          <Input id="full_name" name="full_name" required />
        </Field>
        <Field label="Phone" htmlFor="phone" required>
          <Input id="phone" name="phone" inputMode="tel" required />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" />
        </Field>
        <Field label="Gender" htmlFor="gender">
          <Select id="gender" name="gender" defaultValue="">
            <option value="">Not specified</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Date of birth" htmlFor="date_of_birth">
          <Input id="date_of_birth" name="date_of_birth" type="date" />
        </Field>
        <Field label="Height (cm)" htmlFor="height_cm">
          <Input id="height_cm" name="height_cm" type="number" step="0.1" min="0" />
        </Field>
        <Field label="Weight (kg)" htmlFor="weight_kg">
          <Input id="weight_kg" name="weight_kg" type="number" step="0.1" min="0" />
        </Field>
      </div>
      <Field label="Address" htmlFor="address">
        <Textarea id="address" name="address" rows={2} />
      </Field>
      <Field label="Anything we should know?" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={2} placeholder="Optional" />
      </Field>

      {/* Plan selection */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Choose your plan <span className="text-destructive">*</span>
        </legend>
        <div className="grid gap-2">
          {plans.map((p) => (
            <label
              key={p.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors",
                planId === p.id
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:bg-foreground/5",
              )}
            >
              <input
                type="radio"
                name="plan_id"
                value={p.id}
                required
                checked={planId === p.id}
                onChange={() => setPlanId(p.id)}
                className="size-4 accent-primary"
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.name}</div>
                {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
              </div>
              <div className="text-right">
                <div className="font-semibold">{formatMoney(p.price)}</div>
                <div className="text-xs text-muted-foreground">{p.duration_days} days</div>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Personal Trainer add-on (optional) */}
      {trainerPlans.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Add a Personal Trainer (optional)</legend>
          <p className="text-xs text-muted-foreground">
            Want one-on-one training alongside your membership? Pick a plan — it&apos;s added to your total.
          </p>
          <div className="grid gap-2">
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors",
                ptPlanId === ""
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:bg-foreground/5",
              )}
            >
              <input
                type="radio"
                name="pt_plan_id"
                value=""
                checked={ptPlanId === ""}
                onChange={() => setPtPlanId("")}
                className="size-4 accent-primary"
              />
              <div className="min-w-0 flex-1 font-medium">No personal trainer</div>
            </label>
            {trainerPlans.map((p) => (
              <label
                key={p.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors",
                  ptPlanId === p.id
                    ? "border-primary bg-primary/5"
                    : "border-border/60 hover:bg-foreground/5",
                )}
              >
                <input
                  type="radio"
                  name="pt_plan_id"
                  value={p.id}
                  checked={ptPlanId === p.id}
                  onChange={() => setPtPlanId(p.id)}
                  className="size-4 accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.name}</div>
                  {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatMoney(p.price)}</div>
                  <div className="text-xs text-muted-foreground">{p.duration_days} days</div>
                </div>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* Order summary / total */}
      {selectedPlan && (
        <div className="space-y-1.5 rounded-lg border border-border/60 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{selectedPlan.name}</span>
            <span>{formatMoney(selectedPlan.price)}</span>
          </div>
          {selectedPt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Personal Trainer · {selectedPt.name}</span>
              <span>{formatMoney(selectedPt.price)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border/60 pt-1.5 font-semibold">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>
        </div>
      )}

      {/* Payment method */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Payment method <span className="text-destructive">*</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          <MethodChip value="cash" current={method} onSelect={setMethod} label="Cash" />
          {upiId && <MethodChip value="upi" current={method} onSelect={setMethod} label="UPI" />}
        </div>

        {method === "cash" && (
          <p className="rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">
            Pay in cash at the gym counter — just submit the form, and the gym will confirm your payment
            when you arrive.
          </p>
        )}

        {method === "upi" && upiId && (
          <div className="space-y-3 rounded-lg border border-border/60 p-3">
            {!selectedPlan ? (
              <p className="text-sm text-muted-foreground">
                Select a plan above to see the exact amount and payment QR.
              </p>
            ) : (
              <>
                <p className="text-sm">
                  Pay <span className="font-semibold">{formatMoney(total)}</span> to{" "}
                  <span className="font-mono">{upiId}</span>
                  {upiPayeeName ? ` (${upiPayeeName})` : ""}.
                </p>
                {comboQr && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={comboQr}
                    alt="UPI payment QR"
                    className="mx-auto size-44 rounded-md bg-white p-2"
                  />
                )}
                <p className="text-center text-xs text-muted-foreground">
                  Scan with any UPI app (GPay, PhonePe, Paytm…) to pay the exact amount.
                </p>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="payment_proof">
                Payment screenshot <span className="text-destructive">*</span>
              </Label>
              <Input
                id="payment_proof"
                name="payment_proof"
                type="file"
                accept="image/*"
                required
                onChange={(e) => onPickImage(e, PROOF_TARGET, setProofPreview)}
              />
              {proofPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={proofPreview} alt="Payment screenshot preview" className="max-h-40 rounded-md border" />
              )}
            </div>
          </div>
        )}
      </fieldset>

      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending || compressing} className="w-full">
        {compressing ? "Processing image…" : pending ? "Submitting…" : "Submit registration"}
      </Button>
    </form>
  );
}

function MethodChip({
  value,
  current,
  onSelect,
  label,
}: {
  value: "cash" | "upi";
  current: string;
  onSelect: (v: "cash" | "upi") => void;
  label: string;
}) {
  const active = current === value;
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary/10" : "border-border/60 hover:bg-foreground/5",
      )}
    >
      <input
        type="radio"
        name="payment_method"
        value={value}
        required
        checked={active}
        onChange={() => onSelect(value)}
        className="size-4 accent-primary"
      />
      {label}
    </label>
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
