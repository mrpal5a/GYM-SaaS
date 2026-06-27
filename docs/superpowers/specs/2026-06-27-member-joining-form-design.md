# Member Joining Form (PDF) — Design

**Date:** 2026-06-27
**Status:** Approved (pending spec review)

## Summary

Add a downloadable, system-generated **membership joining form** for each member. The
form shows the gym's branding (logo, name, address), the member's full details and
membership, and the gym's rules — which each gym owner defines in Settings. The form
downloads as a real PDF from the member's detail page.

This mirrors the existing **invoice** feature, which already renders a server-side PDF
with `@react-pdf/renderer` (`src/lib/payments/invoice-pdf.tsx`).

## Goals

- Gym owner can set a **gym address** and a list of **gym rules** in Settings.
- Each member's detail page has a **"Joining form"** button that downloads a PDF.
- The PDF contains: gym logo + name + address, the member's photo and all profile
  details, their membership (plan, dates, status, **serial as membership number**),
  the gym's rules, and a "system-generated" footer.

## Non-Goals (YAGNI)

- No signature lines (member or guardian). The form is fully auto-generated.
- No member-facing self-service portal — "member profile" means the staff-facing
  member detail page (`/members/[id]`). There is no member login in this app.
- No emailing/WhatsApp of the joining form in this iteration (download only).
- No per-member rule overrides — rules are gym-wide.

## Data Model

Migration `supabase/migrations/0021_gym_join_form.sql`:

```sql
alter table public.gyms
  add column if not exists address text,
  add column if not exists rules   jsonb not null default '[]'::jsonb;
```

- `address` — the gym's location/address (free-form, multi-line).
- `rules` — an ordered JSON array of rule strings, e.g. `["Always carry a towel", ...]`.

No member-table changes; all member fields already exist.

Update the `Gym` interface in `src/types/db.ts` to add `address: string | null` and
`rules: string[]`.

## Settings UI

All changes live in the existing Settings page — no new routes.

### Gym address
- Add an **address** `textarea` to `GymBrandingForm` (`src/components/settings/gym-branding-form.tsx`).
- Saved via the existing `updateGymBrandingAction` (`src/actions/gym.ts`); extend
  `gymBrandingSchema` (`src/lib/validations/gym.ts`) with an optional `address`
  (trimmed, max ~300 chars).

### Gym rules editor
- New client component `src/components/settings/gym-rules-form.tsx` (`GymRulesForm`).
- Renders the rules as an editable list: each rule is a text input with a delete
  button; an **"Add rule"** button appends a blank input. Order is preserved as listed.
- **Seeding:** when the gym has no rules yet (empty array), the editor is pre-filled
  with a preset list from `src/lib/gym/default-rules.ts` so the owner starts from
  sensible defaults and edits/removes/adds from there. The presets are a UI seed only —
  nothing is persisted until the owner saves.
- New server action `updateGymRulesAction` in `src/actions/gym.ts`, validated by a new
  `gymRulesSchema` in `src/lib/validations/gym.ts`: an array of non-empty trimmed
  strings (each max ~200 chars), max ~30 rules, blank entries dropped before save.
- Owner-only (reuse `canManageGym`), `revalidatePath("/settings")`.

### Preset rules (`src/lib/gym/default-rules.ts`)
A small exported `DEFAULT_GYM_RULES: string[]`, e.g.:
- Always carry a personal towel.
- Wear non-marking gym shoes only — no outdoor footwear.
- Re-rack weights and equipment after use.
- Respect other members; no disruptive behaviour.
- Follow staff and trainer instructions at all times.

## PDF Generation

### Data loader — `src/lib/members/joining-form-data.ts`
`loadJoiningFormData(memberId, ctx?)` returns a `JoiningFormData | null`, RLS-scoped to
the caller's gym exactly like `loadInvoiceData`. Shape:

```ts
interface JoiningFormData {
  gymName: string;
  logoUrl: string | null;
  gymAddress: string | null;
  rules: string[];
  member: {
    fullName: string;
    serial: string;        // formatted membership no. via formatSerial()
    photoUrl: string | null;
    gender: string | null;
    dateOfBirth: string | null;  // pre-formatted
    phone: string | null;
    email: string | null;
    address: string | null;
    height: string | null;       // e.g. "175 cm" or null
    weight: string | null;       // e.g. "72 kg" or null
    joinedAt: string | null;     // pre-formatted
  };
  membership: {
    planName: string | null;
    startDate: string | null;    // pre-formatted
    endDate: string | null;      // pre-formatted
    status: string | null;       // e.g. "Active"
  } | null;
}
```

Reads from `member_with_status` (already used by the member detail page) plus the gym
row. Strings are pre-formatted in the loader so the PDF never re-derives them.

### PDF document — `src/lib/members/joining-form-pdf.tsx`
`JoiningFormDocument` + `renderJoiningFormPdf(data): Promise<Buffer>`, modeled on
`invoice-pdf.tsx`. A4, Helvetica, same color palette `C`.

**Layout:**
- **Header:** logo (left) + gym name + gym address; document title "Membership Joining
  Form". Member **photo** rendered top-right.
- **Member details:** two-column grid — Name, Membership No. (serial), Gender, Date of
  birth, Phone, Email, Address, Height, Weight, Joined date.
- **Membership block:** plan name, start → end dates, status. Omitted gracefully if the
  member has no active membership.
- **Gym Rules:** a "Gym Rules" heading followed by the numbered list of `rules`. If the
  gym has no rules set, the section is omitted.
- **Footer:** "This is a system-generated joining form." + gym name.

**Image handling:** reuse the `fetchLogoDataUri` helper from `invoice-pdf.tsx` for both
the gym logo and the member photo (react-pdf only decodes PNG/JPEG; non-image or fetch
failure degrades gracefully to no image). Lift the helper into a shared module
`src/lib/images/pdf-image.ts` and have `invoice-pdf.tsx` import it from there, so both
documents share one implementation.

## Download Entry Point

### Route handler — `src/app/(app)/members/[id]/joining-form/route.ts`
`GET` handler:
1. `loadJoiningFormData(id)`; `notFound()` / 404 if null.
2. `renderJoiningFormPdf(data)`.
3. Respond with the buffer, `Content-Type: application/pdf`,
   `Content-Disposition: attachment; filename="<slugified-member-name>-joining-form.pdf"`.

### Button
On the member detail header (`src/app/(app)/members/[id]/page.tsx`), add a **"Joining
form"** link (file/document icon) beside Edit/Delete, pointing at
`/members/[id]/joining-form`. A plain anchor — the browser downloads the PDF.

## Authorization

All reads go through `getGymContext()` + Supabase RLS, which confine every query to the
caller's own gym (same as invoices). Settings writes are owner-only via `canManageGym`.

## Testing

- `src/lib/members/joining-form-pdf.test.ts` — mirrors `invoice-pdf.test.ts`: render to
  buffer, assert it begins with `%PDF` and is non-empty; cover the no-membership and
  no-rules branches.
- `src/lib/validations/gym.test.ts` (extend) — `gymRulesSchema` drops blanks, enforces
  limits; `gymBrandingSchema` accepts/cleans `address`.
- `src/lib/gym/default-rules` — trivially assert it's a non-empty string array (guards
  against accidental emptying).

## Files Touched / Added

**Added**
- `supabase/migrations/0021_gym_join_form.sql`
- `src/lib/gym/default-rules.ts`
- `src/components/settings/gym-rules-form.tsx`
- `src/lib/members/joining-form-data.ts`
- `src/lib/members/joining-form-pdf.tsx`
- `src/lib/images/pdf-image.ts` (shared `fetchLogoDataUri`)
- `src/app/(app)/members/[id]/joining-form/route.ts`
- `src/lib/members/joining-form-pdf.test.ts`

**Modified**
- `src/types/db.ts` (Gym: `address`, `rules`)
- `src/lib/gym/branding.ts` (`getGymBranding` also selects/returns `address`, `rules`)
- `src/lib/validations/gym.ts` (+`address`, `gymRulesSchema`)
- `src/actions/gym.ts` (address in branding action; +`updateGymRulesAction`)
- `src/components/settings/gym-branding-form.tsx` (+address textarea)
- `src/app/(app)/settings/page.tsx` (render `GymRulesForm`, pass address/rules)
- `src/components/invoice` / `invoice-pdf.tsx` (import shared `fetchLogoDataUri`)
- `src/app/(app)/members/[id]/page.tsx` (+"Joining form" button)
- `src/lib/validations/gym.test.ts`
