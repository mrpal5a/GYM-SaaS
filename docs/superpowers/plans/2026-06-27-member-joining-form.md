# Member Joining Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a downloadable, system-generated membership joining form (PDF) per member, branded with the gym's logo/name/address and listing the gym's owner-defined rules.

**Architecture:** Two new `gyms` columns (`address`, `rules`) edited in Settings. A server-side `@react-pdf/renderer` document (modeled on the existing invoice PDF) is rendered by a GET route handler that streams the file as a download. A "Joining form" link on the member detail page points at that route.

**Tech Stack:** Next.js 16 (App Router, RSC, route handlers), Supabase (Postgres + RLS), `@react-pdf/renderer`, Zod, Vitest.

---

## File Structure

**Added**
- `supabase/migrations/0021_gym_join_form.sql` — `gyms.address`, `gyms.rules`
- `src/lib/gym/default-rules.ts` — preset rule seed list
- `src/components/settings/gym-rules-form.tsx` — editable rules list (client)
- `src/lib/images/pdf-image.ts` — shared `fetchPdfImageDataUri` helper
- `src/lib/members/joining-form-data.ts` — `loadJoiningFormData` loader + `JoiningFormData` type
- `src/lib/members/joining-form-pdf.tsx` — `JoiningFormDocument` + `renderJoiningFormPdf`
- `src/lib/members/joining-form-pdf.test.ts` — PDF render test
- `src/app/(app)/members/[id]/joining-form/route.ts` — GET → PDF download

**Modified**
- `src/types/db.ts` — `Gym.address`, `Gym.rules`
- `src/lib/validations/gym.ts` — `address` on branding schema; new `gymRulesSchema`
- `src/lib/validations/gym.test.ts` — schema tests
- `src/actions/gym.ts` — address in branding action; new `updateGymRulesAction`
- `src/lib/gym/branding.ts` — `getGymBranding` returns `address`, `rules`
- `src/components/settings/gym-branding-form.tsx` — address textarea
- `src/app/(app)/settings/page.tsx` — render `GymRulesForm`, pass address/rules
- `src/lib/payments/invoice-pdf.tsx` — import shared image helper
- `src/app/(app)/members/[id]/page.tsx` — "Joining form" button

---

## Task 1: Database migration + Gym type

**Files:**
- Create: `supabase/migrations/0021_gym_join_form.sql`
- Modify: `src/types/db.ts` (Gym interface, ~line 20-30)

- [ ] **Step 1: Write the migration**

```sql
-- 0021_gym_join_form.sql
-- Gym address + rules, surfaced on the member joining form PDF.
alter table public.gyms
  add column if not exists address text,
  add column if not exists rules   jsonb not null default '[]'::jsonb;
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push` (or apply via the Supabase SQL editor if the CLI isn't linked).
Expected: migration applies cleanly; `gyms` now has `address` and `rules` columns.

If the CLI isn't configured in this environment, note it and apply the SQL manually in Supabase — do not skip; later tasks read these columns.

- [ ] **Step 3: Extend the Gym type**

In `src/types/db.ts`, add to the `Gym` interface (after `upi_payee_name`):

```ts
  address: string | null;
  rules: string[];
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from this change.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0021_gym_join_form.sql src/types/db.ts
git commit -m "feat(db): add gym address and rules columns"
```

---

## Task 2: Preset rules + validation schemas

**Files:**
- Create: `src/lib/gym/default-rules.ts`
- Modify: `src/lib/validations/gym.ts`
- Test: `src/lib/validations/gym.test.ts` (create if absent)

- [ ] **Step 1: Write the preset rules**

`src/lib/gym/default-rules.ts`:

```ts
/**
 * Seed rules shown in the Settings rules editor when a gym hasn't set any yet.
 * They are a UI starting point only — nothing is persisted until the owner saves.
 */
export const DEFAULT_GYM_RULES: string[] = [
  "Always carry a personal towel.",
  "Wear non-marking gym shoes only — no outdoor footwear.",
  "Re-rack weights and equipment after every use.",
  "Respect other members; avoid disruptive behaviour.",
  "Follow staff and trainer instructions at all times.",
  "Wipe down equipment after use.",
];
```

- [ ] **Step 2: Write the failing validation tests**

Append to `src/lib/validations/gym.test.ts` (create the file with this content if it doesn't exist):

```ts
import { describe, it, expect } from "vitest";
import { gymBrandingSchema, gymRulesSchema } from "./gym";

describe("gymBrandingSchema address", () => {
  it("accepts and trims an address", () => {
    const r = gymBrandingSchema.safeParse({ name: "Iron Paradise", address: "  12 MG Road  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.address).toBe("12 MG Road");
  });

  it("turns a blank address into undefined", () => {
    const r = gymBrandingSchema.safeParse({ name: "Iron Paradise", address: "   " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.address).toBeUndefined();
  });
});

describe("gymRulesSchema", () => {
  it("drops blank rules and trims the rest", () => {
    const r = gymRulesSchema.safeParse(["  Towel  ", "", "   ", "Gym shoes"]);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual(["Towel", "Gym shoes"]);
  });

  it("rejects more than 30 rules", () => {
    const many = Array.from({ length: 31 }, (_, i) => `Rule ${i}`);
    expect(gymRulesSchema.safeParse(many).success).toBe(false);
  });

  it("accepts an empty list", () => {
    const r = gymRulesSchema.safeParse([]);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/validations/gym.test.ts`
Expected: FAIL — `gymRulesSchema` is not exported / `address` not in branding schema.

- [ ] **Step 4: Implement the schema changes**

In `src/lib/validations/gym.ts`, update `gymBrandingSchema` and add `gymRulesSchema`:

```ts
export const gymBrandingSchema = z.object({
  name: z.string().trim().min(1, "Gym name is required").max(120),
  address: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(300).optional(),
  ),
});

// The joining-form rules list. Blank entries are dropped (the editor can leave
// empty inputs); each remaining rule is trimmed and capped, max 30 rules.
export const gymRulesSchema = z.preprocess(
  (v) =>
    Array.isArray(v)
      ? v.map((s) => (typeof s === "string" ? s.trim() : "")).filter((s) => s.length > 0)
      : v,
  z.array(z.string().min(1).max(200)).max(30, "At most 30 rules"),
);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/validations/gym.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Commit**

```bash
git add src/lib/gym/default-rules.ts src/lib/validations/gym.ts src/lib/validations/gym.test.ts
git commit -m "feat: gym rules presets and validation schemas"
```

---

## Task 3: Server actions + branding loader

**Files:**
- Modify: `src/actions/gym.ts`
- Modify: `src/lib/gym/branding.ts`

- [ ] **Step 1: Extend `getGymBranding` to return address + rules**

In `src/lib/gym/branding.ts`, update the interface and query:

```ts
export interface GymBranding {
  id: string;
  name: string;
  logoUrl: string | null;
  address: string | null;
  rules: string[];
}

export async function getGymBranding(): Promise<GymBranding | null> {
  const ctx = await getGymContext();
  if (!ctx) return null;

  const { data } = await ctx.supabase
    .from("gyms")
    .select("id, name, logo_url, address, rules")
    .eq("id", ctx.gymId)
    .single<Pick<Gym, "id" | "name" | "logo_url" | "address" | "rules">>();
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    logoUrl: data.logo_url,
    address: data.address,
    rules: Array.isArray(data.rules) ? data.rules : [],
  };
}
```

- [ ] **Step 2: Save address in the branding action**

In `src/actions/gym.ts`, inside `updateGymBrandingAction`, after `const update ... = { name: parsed.data.name };` line, set address from the parsed schema:

```ts
  const update: Record<string, unknown> = {
    name: parsed.data.name,
    address: parsed.data.address ?? null,
  };
```

(The `gymBrandingSchema` now parses `address`; no other change needed in that action.)

- [ ] **Step 3: Add `updateGymRulesAction`**

Append to `src/actions/gym.ts` (it already imports `getGymContext`, `canManageGym`; add `gymRulesSchema` to the existing validations import):

```ts
export async function updateGymRulesAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getGymContext();
  if (!ctx) return { ok: false, error: "Not authorized" };
  if (!canManageGym(ctx.role)) {
    return { ok: false, error: "Only the gym owner can change gym rules" };
  }

  const rawRules = formData.getAll("rules").map((v) => String(v));
  const parsed = gymRulesSchema.safeParse(rawRules);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  // RLS confines this to the caller's own, owner-managed gym; the eq is defense in depth.
  const { error } = await ctx.supabase
    .from("gyms")
    .update({ rules: parsed.data })
    .eq("id", ctx.gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true };
}
```

Update the import line:

```ts
import { gymBrandingSchema, onboardingSettingsSchema, gymRulesSchema } from "@/lib/validations/gym";
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/actions/gym.ts src/lib/gym/branding.ts
git commit -m "feat: persist gym address and rules"
```

---

## Task 4: Settings UI

**Files:**
- Modify: `src/components/settings/gym-branding-form.tsx`
- Create: `src/components/settings/gym-rules-form.tsx`
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Add address textarea to the branding form**

In `src/components/settings/gym-branding-form.tsx`:

Add the import at the top:

```ts
import { Textarea } from "@/components/ui/textarea";
```

Add an `address` prop:

```ts
export function GymBrandingForm({
  name,
  logoUrl,
  address,
}: {
  name: string;
  logoUrl: string | null;
  address: string | null;
}) {
```

Add this block immediately after the gym-name `<div className="space-y-1.5">…</div>` (before the Logo block):

```tsx
      <div className="space-y-1.5">
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          name="address"
          rows={2}
          maxLength={300}
          defaultValue={address ?? ""}
          placeholder="12 MG Road, Indiranagar, Bengaluru 560038"
        />
        <p className="text-xs text-muted-foreground">
          Shown in the header of each member&apos;s joining form.
        </p>
      </div>
```

- [ ] **Step 2: Create the rules editor component**

`src/components/settings/gym-rules-form.tsx`:

```tsx
"use client";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateGymRulesAction } from "@/actions/gym";
import { DEFAULT_GYM_RULES } from "@/lib/gym/default-rules";

export function GymRulesForm({ rules }: { rules: string[] }) {
  const [state, action, pending] = useActionState(updateGymRulesAction, null);
  // Seed with presets the first time (no rules saved yet) so owners start from
  // sensible defaults; otherwise show what's saved.
  const [items, setItems] = useState<string[]>(rules.length > 0 ? rules : DEFAULT_GYM_RULES);

  useEffect(() => {
    if (state?.ok) toast.success("Gym rules saved");
  }, [state]);

  function update(index: number, value: string) {
    setItems((prev) => prev.map((r, i) => (i === index ? value : r)));
  }
  function remove(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }
  function add() {
    setItems((prev) => [...prev, ""]);
  }

  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        These appear on every member&apos;s joining form. Add the rules specific to your gym.
      </p>
      <div className="space-y-2">
        {items.map((rule, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{i + 1}.</span>
            <Input
              name="rules"
              value={rule}
              maxLength={200}
              onChange={(e) => update(i, e.target.value)}
              placeholder="e.g. Always carry a towel"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(i)}
              aria-label={`Remove rule ${i + 1}`}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <PlusIcon /> Add rule
      </Button>
      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="border-t border-border/40 pt-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save rules"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Wire the settings page**

In `src/app/(app)/settings/page.tsx`:

Add the import:

```ts
import { GymRulesForm } from "@/components/settings/gym-rules-form";
```

Pass `address` to the branding form:

```tsx
          <GymBrandingForm
            name={branding?.name ?? ""}
            logoUrl={branding?.logoUrl ?? null}
            address={branding?.address ?? null}
          />
```

Add a new card after the Branding card (before the self-onboarding card):

```tsx
      <Card className="glass">
        <CardHeader>
          <CardTitle>Joining form rules</CardTitle>
        </CardHeader>
        <CardContent>
          <GymRulesForm rules={branding?.rules ?? []} />
        </CardContent>
      </Card>
```

- [ ] **Step 4: Verify it builds and renders**

Run: `npx tsc --noEmit`
Expected: no errors.

Then, with the dev server running, open `/settings` and confirm: the Address field shows under the gym name, and a "Joining form rules" card lists the preset rules with Add/remove and a Save button. Save edits and confirm the toast.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/gym-branding-form.tsx src/components/settings/gym-rules-form.tsx "src/app/(app)/settings/page.tsx"
git commit -m "feat(settings): gym address field and rules editor"
```

---

## Task 5: Shared PDF image helper

**Files:**
- Create: `src/lib/images/pdf-image.ts`
- Modify: `src/lib/payments/invoice-pdf.tsx`

- [ ] **Step 1: Create the shared helper**

`src/lib/images/pdf-image.ts` (lifted verbatim from `invoice-pdf.tsx`):

```ts
import "server-only";

/**
 * Fetch an image URL and inline it as a data URI so a react-pdf render never
 * depends on a live network image (a flaky URL would otherwise reject the whole
 * render). react-pdf only decodes PNG/JPEG, so anything else is skipped gracefully.
 */
export async function fetchPdfImageDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!/^image\/(png|jpe?g)$/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Use it in the invoice PDF**

In `src/lib/payments/invoice-pdf.tsx`, delete the local `fetchLogoDataUri` function (lines ~115-132) and import the shared one. Add near the top:

```ts
import { fetchPdfImageDataUri } from "@/lib/images/pdf-image";
```

Update `renderInvoicePdf`:

```ts
export async function renderInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const logo = await fetchPdfImageDataUri(data.logoUrl);
  return renderToBuffer(<InvoiceDocument data={data} logo={logo} />);
}
```

- [ ] **Step 3: Verify the invoice PDF test still passes**

Run: `npx vitest run src/lib/payments/invoice-pdf.test.ts`
Expected: PASS (unchanged behaviour).

- [ ] **Step 4: Commit**

```bash
git add src/lib/images/pdf-image.ts src/lib/payments/invoice-pdf.tsx
git commit -m "refactor: share react-pdf image-inlining helper"
```

---

## Task 6: Joining form data loader

**Files:**
- Create: `src/lib/members/joining-form-data.ts`

- [ ] **Step 1: Write the loader**

`src/lib/members/joining-form-data.ts`:

```ts
import "server-only";
import { getGymContext, type GymContext } from "@/lib/auth/context";
import { formatDate, formatSerial } from "@/lib/members/metrics";
import type { Gym, MemberWithStatus } from "@/types/db";

export interface JoiningFormData {
  gymName: string;
  logoUrl: string | null;
  gymAddress: string | null;
  rules: string[];
  member: {
    fullName: string;
    serial: string;
    photoUrl: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    height: string | null;
    weight: string | null;
    joinedAt: string | null;
  };
  membership: {
    planName: string;
    startDate: string | null;
    endDate: string | null;
    status: string;
  } | null;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Everything needed to render a member's joining form PDF. Strings are
 * pre-formatted here so the document never re-derives them. RLS confines every
 * read to the caller's own gym; returns null when there's no context or the
 * member isn't visible to the caller.
 */
export async function loadJoiningFormData(
  memberId: string,
  ctx?: GymContext,
): Promise<JoiningFormData | null> {
  const context = ctx ?? (await getGymContext());
  if (!context) return null;
  const { supabase, gymId } = context;

  const [{ data: memberRow }, { data: gymRow }] = await Promise.all([
    supabase.from("member_with_status").select("*").eq("id", memberId).single(),
    supabase
      .from("gyms")
      .select("name, logo_url, address, rules")
      .eq("id", gymId)
      .single<Pick<Gym, "name" | "logo_url" | "address" | "rules">>(),
  ]);
  if (!memberRow) return null;
  const m = memberRow as MemberWithStatus;

  const hasMembership = Boolean(m.subscription_id) && m.membership_status !== "none";

  return {
    gymName: gymRow?.name ?? "Your Gym",
    logoUrl: gymRow?.logo_url ?? null,
    gymAddress: gymRow?.address ?? null,
    rules: Array.isArray(gymRow?.rules) ? gymRow!.rules : [],
    member: {
      fullName: m.full_name,
      serial: formatSerial(m.serial),
      photoUrl: m.photo_url,
      gender: m.gender ? cap(m.gender) : null,
      dateOfBirth: m.date_of_birth ? formatDate(m.date_of_birth) : null,
      phone: m.phone,
      email: m.email,
      address: m.address,
      height: m.height_cm ? `${m.height_cm} cm` : null,
      weight: m.weight_kg ? `${m.weight_kg} kg` : null,
      joinedAt: m.joined_at ? formatDate(m.joined_at) : null,
    },
    membership: hasMembership
      ? {
          planName: m.plan_name ?? "Membership",
          startDate: m.start_date ? formatDate(m.start_date) : null,
          endDate: m.end_date ? formatDate(m.end_date) : null,
          status: cap(m.membership_status),
        }
      : null,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/members/joining-form-data.ts
git commit -m "feat: joining form data loader"
```

---

## Task 7: Joining form PDF document

**Files:**
- Create: `src/lib/members/joining-form-pdf.tsx`
- Test: `src/lib/members/joining-form-pdf.test.ts`

- [ ] **Step 1: Write the failing render test**

`src/lib/members/joining-form-pdf.test.ts`:

```ts
// @vitest-environment node
import { vi, describe, it, expect } from "vitest";
import type { JoiningFormData } from "./joining-form-data";

vi.mock("server-only", () => ({}));

const { renderJoiningFormPdf } = await import("./joining-form-pdf");

const base: JoiningFormData = {
  gymName: "Iron Paradise",
  logoUrl: null,
  gymAddress: "12 MG Road, Bengaluru 560038",
  rules: ["Always carry a towel.", "Wear gym shoes only."],
  member: {
    fullName: "Rahul Sharma",
    serial: "#0007",
    photoUrl: null,
    gender: "Male",
    dateOfBirth: "01 Jan 1995",
    phone: "+91 98765 43210",
    email: "rahul@example.com",
    address: "5th Cross, Indiranagar",
    height: "175 cm",
    weight: "72 kg",
    joinedAt: "25 Jun 2026",
  },
  membership: {
    planName: "Gold",
    startDate: "25 Jun 2026",
    endDate: "25 Jul 2026",
    status: "Active",
  },
};

describe("renderJoiningFormPdf", () => {
  it("renders a valid non-empty PDF", async () => {
    const buf = await renderJoiningFormPdf(base);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }, 30_000);

  it("renders when there is no membership and no rules", async () => {
    const buf = await renderJoiningFormPdf({ ...base, membership: null, rules: [] });
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }, 30_000);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/members/joining-form-pdf.test.ts`
Expected: FAIL — `joining-form-pdf` module not found.

- [ ] **Step 3: Write the PDF document**

`src/lib/members/joining-form-pdf.tsx`:

```tsx
import "server-only";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { fetchPdfImageDataUri } from "@/lib/images/pdf-image";
import type { JoiningFormData } from "@/lib/members/joining-form-data";

const C = {
  ink: "#1f2937",
  muted: "#6b7280",
  faint: "#9ca3af",
  line: "#e5e7eb",
  rule: "#d1d5db",
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: C.ink, lineHeight: 1.4 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 12 },
  logo: { width: 64, height: 64, borderRadius: 8, objectFit: "cover", marginRight: 14 },
  gymName: { fontSize: 24, fontFamily: "Helvetica-Bold" },
  gymAddress: { fontSize: 12, color: C.muted, marginTop: 4, maxWidth: 320 },
  photo: { width: 84, height: 100, borderRadius: 6, objectFit: "cover", borderWidth: 1, borderColor: C.line },

  divider: { borderBottomWidth: 1, borderBottomColor: C.rule, marginTop: 16, marginBottom: 16 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 20 },

  section: { marginBottom: 20 },
  sectionHeading: { fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },

  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "50%", marginBottom: 8, paddingRight: 12 },
  cellLabel: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  cellValue: { fontSize: 11, marginTop: 1 },

  ruleRow: { flexDirection: "row", marginBottom: 5 },
  ruleNum: { width: 18, color: C.muted },
  ruleText: { flex: 1 },

  footer: { marginTop: "auto", borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 12, textAlign: "center", fontSize: 9, color: C.muted },
});

function Cell({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value ?? "—"}</Text>
    </View>
  );
}

function JoiningFormDocument({
  data,
  logo,
  photo,
}: {
  data: JoiningFormData;
  logo: string | null;
  photo: string | null;
}) {
  const { member, membership } = data;
  return (
    <Document title={`Joining Form — ${member.fullName}`} author={data.gymName}>
      <Page size="A4" style={styles.page}>
        {/* Gym header */}
        <View style={styles.header}>
          <View style={styles.brand}>
            {logo ? <Image src={logo} style={styles.logo} /> : null}
            <View>
              <Text style={styles.gymName}>{data.gymName}</Text>
              {data.gymAddress ? <Text style={styles.gymAddress}>{data.gymAddress}</Text> : null}
            </View>
          </View>
          {photo ? <Image src={photo} style={styles.photo} /> : null}
        </View>

        <View style={styles.divider} />
        <Text style={styles.title}>Membership Joining Form</Text>

        {/* Member details */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Member Details</Text>
          <View style={styles.grid}>
            <Cell label="Name" value={member.fullName} />
            <Cell label="Membership No." value={member.serial} />
            <Cell label="Gender" value={member.gender} />
            <Cell label="Date of Birth" value={member.dateOfBirth} />
            <Cell label="Phone" value={member.phone} />
            <Cell label="Email" value={member.email} />
            <Cell label="Address" value={member.address} />
            <Cell label="Joined" value={member.joinedAt} />
            <Cell label="Height" value={member.height} />
            <Cell label="Weight" value={member.weight} />
          </View>
        </View>

        {/* Membership details */}
        {membership ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Membership Details</Text>
            <View style={styles.grid}>
              <Cell label="Plan" value={membership.planName} />
              <Cell label="Status" value={membership.status} />
              <Cell label="Start Date" value={membership.startDate} />
              <Cell label="End Date" value={membership.endDate} />
            </View>
          </View>
        ) : null}

        {/* Gym rules */}
        {data.rules.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Gym Rules</Text>
            {data.rules.map((rule, i) => (
              <View key={i} style={styles.ruleRow}>
                <Text style={styles.ruleNum}>{i + 1}.</Text>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.footer}>
          This is a system-generated joining form · {data.gymName}
        </Text>
      </Page>
    </Document>
  );
}

/** Render a member's joining form to a PDF Buffer. */
export async function renderJoiningFormPdf(data: JoiningFormData): Promise<Buffer> {
  const [logo, photo] = await Promise.all([
    fetchPdfImageDataUri(data.logoUrl),
    fetchPdfImageDataUri(data.member.photoUrl),
  ]);
  return renderToBuffer(<JoiningFormDocument data={data} logo={logo} photo={photo} />);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/members/joining-form-pdf.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/members/joining-form-pdf.tsx src/lib/members/joining-form-pdf.test.ts
git commit -m "feat: joining form PDF document"
```

---

## Task 8: Download route + member detail button

**Files:**
- Create: `src/app/(app)/members/[id]/joining-form/route.ts`
- Modify: `src/app/(app)/members/[id]/page.tsx`

- [ ] **Step 1: Write the route handler**

`src/app/(app)/members/[id]/joining-form/route.ts`:

```ts
import { loadJoiningFormData } from "@/lib/members/joining-form-data";
import { renderJoiningFormPdf } from "@/lib/members/joining-form-pdf";

export const dynamic = "force-dynamic";

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "member";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await loadJoiningFormData(id);
  if (!data) return new Response("Not found", { status: 404 });

  const pdf = await renderJoiningFormPdf(data);
  const filename = `${slugify(data.member.fullName)}-joining-form.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
```

- [ ] **Step 2: Add the button on the member detail page**

In `src/app/(app)/members/[id]/page.tsx`:

Add `FileTextIcon` to the lucide import (line 3):

```ts
import { ArrowLeftIcon, PencilIcon, DumbbellIcon, FileTextIcon } from "lucide-react";
```

In the header action group (the `<div className="flex items-center gap-2">` holding Edit + Delete, ~line 103), add this link before the Edit link:

```tsx
            <a
              href={`/members/${id}/joining-form`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <FileTextIcon /> Joining form
            </a>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

With the dev server running and signed in as an owner:
1. Open a member's detail page → click **Joining form**.
2. A PDF downloads named `<member>-joining-form.pdf`.
3. Open it: gym name (large) + address + logo in the header, member photo top-right, "Membership Joining Form" title, member details grid (serial as Membership No.), membership block, numbered gym rules, system-generated footer.
4. Confirm a member with no active membership and a gym with no rules still produces a clean PDF (those sections simply absent).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/members/[id]/joining-form/route.ts" "src/app/(app)/members/[id]/page.tsx"
git commit -m "feat: download member joining form PDF"
```

---

## Task 9: Full verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the new validation and PDF tests.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: End-to-end smoke**

Confirm the Task 4 (settings) and Task 8 (download) manual checks both still pass against the running app, including editing rules in Settings and seeing the change reflected in a freshly downloaded PDF.

---

## Notes

- **Auth/RLS:** every read goes through `getGymContext()` + Supabase RLS (same as invoices), so a member from another gym yields `null` → 404. Settings writes are owner-only via `canManageGym`.
- **Graceful degradation:** missing logo, photo, address, membership, or rules each drop their element without breaking layout — covered by the second PDF test and the manual check.
- **No new dependencies:** `@react-pdf/renderer`, `zod`, `lucide-react`, and the Textarea UI component are all already in the project.
