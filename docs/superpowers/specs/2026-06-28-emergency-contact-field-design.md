# Emergency / alternate contact number on member intake

**Date:** 2026-06-28
**Status:** Approved

## Problem

A gym owner needs an alternate / emergency phone number for each member so they can
reach someone if a member has a medical or other emergency at the gym. The public
join form (filled by the prospect after scanning the gym's QR code) currently has no
such field, and neither does the member record.

## Goal

Capture an "Alternate / Emergency mobile number" for every member, primarily via the
public join form, and surface it everywhere member contact details appear.

## Field

- Single column **`emergency_phone text`** (nullable at the DB level) on both
  `public.members` and `public.join_requests`.
- Form label: **"Alternate / Emergency mobile number"**.

### Required vs optional, by surface

- **Public QR join form** — **required**. Validated in `joinRequestSchema` with the
  same rule as the primary phone: trimmed, 5–20 chars.
- **Owner's manual add/edit member form** — **optional** (in `memberSchema`), so an
  owner is never blocked when adding a walk-in who didn't provide one.
- DB columns stay nullable so existing rows don't break; the "required" rule lives in
  the validation layer for the public form only.

## Migration `0024_member_emergency_phone.sql`

1. `alter table public.members add column emergency_phone text;`
2. `alter table public.join_requests add column emergency_phone text;`
3. **Drop + recreate** the `member_with_status` view. It selects `m.*`, and a
   `create or replace view` cannot reorder/add columns through `m.*`; the existing
   0020 migration established this drop+recreate pattern for the same reason.
4. `create or replace function public.approve_join_request(...)` — add
   `emergency_phone` to the `insert into public.members (...)` column list and
   `values (..., v_req.emergency_phone, ...)`, so the value carries over when a
   request is approved. Function signature is unchanged.

## Write path

Most of the write path flows automatically once the column + schema exist:

- **`src/components/join/join-form.tsx`** — add a required text input next to
  "Phone" (`name="emergency_phone"`, `inputMode="tel"`, `required`).
- **`src/lib/validations/join.ts`** — add `emergency_phone` (required, 5–20 chars).
  `submitJoinRequestAction` already spreads `...member` into the insert, so no action
  change is needed.
- **`src/components/members/member-form.tsx`** — add an optional text input next to
  "Phone", with `defaultValue={member?.emergency_phone ?? ""}`.
- **`src/lib/validations/member.ts`** — add `emergency_phone` as optional text. The
  create and update member actions already spread `...parsed.data`, so no action
  change is needed.

## Display

- **`src/app/(app)/members/[id]/page.tsx`** — add a `Detail` row labelled
  "Emergency contact" (value `member.emergency_phone || "—"`).
- **`src/app/(app)/join-requests/page.tsx`** — add a `Detail` row so the owner sees
  the emergency number before approving.
- **`src/lib/members/joining-form-pdf.tsx`** — add the field to the printable joining
  form, alongside the existing phone field.
- **`src/types/db.ts`** — add `emergency_phone: string | null` to both the `Member`
  and `JoinRequest` interfaces.

## Data flow

```
Public join form (required)
  -> joinRequestSchema (validates required)
  -> submitJoinRequestAction (...member spread)
  -> join_requests.emergency_phone
  -> approve_join_request RPC (copies to members)
  -> members.emergency_phone
  -> member_with_status view (m.*)
  -> member detail page / joining-form PDF

Owner manual add/edit (optional)
  -> member-form.tsx
  -> memberSchema (optional)
  -> create/update member action (...parsed.data spread)
  -> members.emergency_phone
```

## Error handling

- Public form submitted without the number → `joinRequestSchema` fails; the existing
  action returns the first issue message to the form ("Emergency contact number is
  required").
- Owner manual form left blank → accepted (optional); stored as null.

## Testing

- **Join schema** (`src/lib/validations/join.test.ts`, new if absent): missing
  `emergency_phone` → fails with the required message; a valid value → passes; the
  rest of a valid payload still parses.
- **Member schema** (`src/lib/validations/member.test.ts`, new if absent):
  `emergency_phone` is optional — blank string preprocesses to `undefined`; a value
  passes through.
- **Manual verification**: submit the public form without the field (blocked) and
  with it (accept); approve the request; confirm the number appears on the member
  detail page and in the printable joining form.

## Out of scope (YAGNI)

- A separate emergency-contact name / relationship field (number only, per decision).
- Validating that the emergency number differs from the primary phone.
- Backfilling existing members.
