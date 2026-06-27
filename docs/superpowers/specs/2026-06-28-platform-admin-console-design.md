# Platform Admin Console — Design (Phase 8, scoped)

**Date:** 2026-06-28
**Status:** Approved for planning
**Phase:** 8 (Super-admin) — dashboard, onboarding, subscription control, and per-gym export. Plan *enforcement* and automated billing are deferred.

---

## 1. Problem & goal

GymFlow Pro is a multi-tenant SaaS sold to gym owners. The platform operator (a single `super_admin` account) needs a console — separate from any individual gym — to:

1. See every gym currently using the software, with its owner, total members, revenue (this month + all-time), and SaaS plan status/expiry.
2. Onboard a new gym + owner account directly (operator sets the owner's email and initial password).
3. Manage each gym's SaaS subscription (plan, status, period-end / expiry).
4. Download a gym's full data as an Excel workbook on request, to hand to the owner.

The data foundation already exists: `super_admin` is in the `app_role` enum, RLS already grants `super_admin` cross-tenant read/write on every table, `homePathForRole` already routes `super_admin → /admin`, middleware already blocks non-admins from `/admin`, and a placeholder `/admin` page exists. This spec fills in the UI, two RPCs, the onboarding action, and the export.

### Out of scope (deferred)

- Automated SaaS billing / payment collection from gym owners.
- Plan **enforcement** (locking a gym out when `past_due` / expired).
- Email notifications to owners (onboarding, renewal reminders).
- Deleting / suspending gyms.

---

## 2. Decisions (resolved during brainstorming)

| Decision | Resolution |
|---|---|
| "Expiry of membership detail" means | The **gym's SaaS plan expiry** (`subscriptions.current_period_end`), not the gym's own members' expiries. |
| Onboarding scope | Admin **can create** a new gym + owner account directly. |
| Owner credentials | Admin **enters the owner's email AND initial password** in the form; service-role `createUser` with that password. |
| Export format | **Excel workbook (`.xlsx`)**, multi-tab. |
| Per-gym stats aggregation | A single `SECURITY DEFINER` SQL function (`admin_gym_overview()`) — no N+1, no client-side aggregation. |
| Subscription editing location | A per-gym **detail page** (`/admin/gyms/[id]`) hosts the subscription editor and download button; the list links to it. |
| New dependency | `exceljs` (the only new npm dependency in this slice). |

---

## 3. Architecture & routing

A new route group isolates the admin shell from the gym (`(app)`) shell.

```
src/app/(admin)/
  layout.tsx                         # admin shell: product name + logout; nav: Gyms
  admin/
    page.tsx                         # gyms dashboard (summary cards + table)
    gyms/
      [id]/
        page.tsx                     # gym detail: stats, subscription editor, download button
        export/
          route.ts                   # GET → streams .xlsx attachment
```

- The existing placeholder `src/app/(app)/admin/page.tsx` is **removed**; `/admin` now resolves through the `(admin)` group. The URL path stays `/admin`.
- **Admin shell (`(admin)/layout.tsx`)** is deliberately minimal — no gym branding, no gym sidebar, no `RequestsPoller`. Top bar with the product name and a logout control; a thin nav with **Gyms**.
- **Guard `getAdminContext()`** — new `src/lib/auth/admin-context.ts`, mirroring `getGymContext`:
  ```ts
  export interface AdminContext {
    supabase: Awaited<ReturnType<typeof createClient>>;
    userId: string;
  }
  // Returns null unless claims.user_role === 'super_admin'.
  export const getAdminContext = cache(async (): Promise<AdminContext | null> => { ... });
  ```
  Every admin page, server action, and the export route calls this first and treats `null` as 403/redirect-to-`/login`. Middleware blocks non-admins at the edge; this is the in-process belt-and-suspenders and also yields the Supabase client. Wrapped in React `cache()` like `getGymContext`.
- **`(app)/layout.tsx` fix** — when `getGymContext()` returns `null` *and* the caller is a `super_admin` (gym-less), redirect to `/admin` so the operator never sees an empty gym shell. Detect role from `getClaims()` (cheap, no network round-trip).

---

## 4. Database — migration `0022_admin_console.sql`

### 4.1 `admin_gym_overview()` — list aggregation

`SECURITY DEFINER`, guarded to `super_admin`. Returns one row per gym so the dashboard renders from a single query.

```sql
create or replace function public.admin_gym_overview()
returns table (
  gym_id              uuid,
  name                text,
  slug                text,
  owner_name          text,
  owner_email         text,
  member_count        bigint,   -- active members in the gym (is_active = true)
  revenue_total       numeric,  -- sum(payments.amount), all-time
  revenue_this_month  numeric,  -- sum where paid_at >= date_trunc('month', now())
  plan                sub_plan,
  status              sub_status,
  current_period_end  timestamptz,
  created_at          timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.current_role_name() <> 'super_admin' then
    raise exception 'forbidden: super_admin only';
  end if;

  return query
  select g.id, g.name, g.slug,
         o.full_name, o.email,
         coalesce(m.cnt, 0),
         coalesce(p.total, 0),
         coalesce(p.month, 0),
         s.plan, s.status, s.current_period_end,
         g.created_at
  from public.gyms g
  left join public.profiles o on o.id = g.owner_id
  left join public.subscriptions s on s.gym_id = g.id
  left join (
    select gym_id, count(*) cnt from public.members
    where is_active group by gym_id
  ) m on m.gym_id = g.id
  left join (
    select gym_id,
           sum(amount) total,
           sum(amount) filter (where paid_at >= date_trunc('month', now())) month
    from public.payments group by gym_id
  ) p on p.gym_id = g.id
  order by g.created_at desc;
end;
$$;

grant execute on function public.admin_gym_overview() to authenticated;
```

Notes:
- `member_count` is **active** members only (`is_active = true`) — operator-facing scale metric.
- Revenue is the sum of the gym's collected member `payments` (the money the gym takes in), not SaaS revenue. "This month" uses server `now()` (UTC); acceptable for an operator overview.

### 4.2 `admin_create_gym_with_owner(...)` — onboarding wiring

`SECURITY DEFINER`, guarded to `super_admin`. The auth user is created first (service role, in the server action); this RPC atomically wires up the app rows for that user id. Models the existing `create_gym_with_owner`.

```sql
create or replace function public.admin_create_gym_with_owner(
  p_user_id    uuid,
  p_email      text,
  p_full_name  text,
  p_gym_name   text,
  p_slug       text,
  p_plan       sub_plan,
  p_period_end timestamptz
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym_id uuid;
begin
  if public.current_role_name() <> 'super_admin' then
    raise exception 'forbidden: super_admin only';
  end if;

  insert into public.gyms (name, slug) values (p_gym_name, p_slug)
  returning id into v_gym_id;

  insert into public.profiles (id, gym_id, role, full_name, email)
  values (p_user_id, v_gym_id, 'gym_owner', p_full_name, p_email);

  update public.gyms set owner_id = p_user_id where id = v_gym_id;

  insert into public.subscriptions (gym_id, plan, status, current_period_end)
  values (v_gym_id, p_plan, 'active', p_period_end);

  insert into public.audit_logs (gym_id, actor_id, action, entity, entity_id, metadata)
  values (v_gym_id, auth.uid(), 'gym.created_by_admin', 'gym', v_gym_id::text,
          jsonb_build_object('owner_id', p_user_id));

  return v_gym_id;
end;
$$;

grant execute on function public.admin_create_gym_with_owner(uuid, text, text, text, text, sub_plan, timestamptz)
  to authenticated;
```

- New gyms onboarded by the admin start `status = 'active'` (the operator is selling them the plan), unlike self-signup which starts `trialing`.
- `current_period_end` is the SaaS expiry the operator sets.

### 4.3 Subscription edits

**No new RPC.** RLS policy `subs_modify` already lets `super_admin` `update` any `subscriptions` row. The edit goes through the operator's RLS-scoped client.

---

## 5. Onboarding flow

`src/actions/admin.ts` → `adminCreateGymAction(prevState, formData)`:

1. Parse + validate with a zod schema (`src/lib/validations/admin.ts`): `gymName`, `ownerFullName`, `email`, `password` (min 8), `plan` (enum), `periodEnd` (date).
2. `getAdminContext()` guard — reject if not super_admin.
3. `createAdminClient().auth.admin.createUser({ email, password, email_confirm: true })` → owner user id. Surface a friendly error on duplicate email.
4. Build slug: `${slugify(gymName)}-${userId.slice(0,6)}` (matches signup convention).
5. Call `admin_create_gym_with_owner` RPC with the user id + form fields.
6. **Orphan cleanup:** if the RPC errors after user creation, call `admin.auth.admin.deleteUser(userId)` and return the RPC error.
7. On success: `revalidatePath('/admin')` and close the form / redirect to `/admin`.

The form is a dialog (or `/admin/gyms/new`) on the dashboard, using the existing form primitives + `react-hook-form` + the action.

---

## 6. Subscription management

On `/admin/gyms/[id]`, an editor with: `plan` (select: starter/professional/enterprise), `status` (select: trialing/active/past_due/canceled), `current_period_end` (date input). Submit → `adminUpdateSubscriptionAction(gymId, formData)`:

1. `getAdminContext()` guard.
2. Validate (zod).
3. `ctx.supabase.from('subscriptions').update({ plan, status, current_period_end }).eq('gym_id', gymId)` — RLS authorizes.
4. Insert an `audit_logs` row (`subscription.updated_by_admin`) — optional but consistent with the audit pattern; if RLS blocks direct audit insert, skip (audit inserts are normally via SECURITY DEFINER). **Decision:** skip the audit insert here to avoid an extra RPC; the action is low-frequency and operator-initiated.
5. `revalidatePath('/admin/gyms/' + gymId)` and `/admin`.

---

## 7. Per-gym Excel export

Route handler `src/app/(admin)/admin/gyms/[id]/export/route.ts` (`GET`):

1. `getAdminContext()` guard → 403 if not super_admin.
2. Fetch for the target `gym_id` (RLS lets super_admin read all): `gyms` row, `members`, `membership_plans`, `member_subscriptions`, `payments`.
3. Build an `exceljs` workbook with tabs:
   - **Gym Info** — name, slug, owner, created date, plan, status, expiry, totals.
   - **Members** — name, email, phone, gender, DOB, joined, active, created.
   - **Plans** — name, price, duration days, active.
   - **Subscriptions** — member, plan name, start, end, status.
   - **Payments** — member, amount, method, invoice #, paid at, note.
4. Return the buffer with headers:
   ```
   Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
   Content-Disposition: attachment; filename="<slug>-export-<YYYY-MM-DD>.xlsx"
   ```

The workbook construction lives in a **pure builder** `src/lib/admin/export-workbook.ts` (`buildGymWorkbook(data) → ExcelJS.Workbook`) so it is unit-testable without HTTP. The route handler only does auth + fetch + stream.

---

## 8. Dashboard UI (`/admin`)

Server component calling `admin_gym_overview()` via `getAdminContext().supabase.rpc(...)`.

- **Summary cards:** total gyms, total members (sum), total revenue (sum). Computed from the same result set.
- **Gyms table:** `Name · Owner (name + email) · Members · Revenue (this month / total) · Plan · Status · Expiry · Actions`.
  - **Expiry** renders a badge via a pure helper `subscriptionExpiryStatus(current_period_end, now)` → `expired | expiring_soon | active` (expiring_soon = within 14 days). Color: red / amber / muted.
  - **Status** badge maps `sub_status` to a tone.
  - **Actions:** "Manage" (→ `/admin/gyms/[id]`) and "Download" (→ the export route).
- **Onboard gym** button opens the onboarding form (Section 5).
- Reuses existing `Card`, table, and badge primitives. This is an internal operator tool: kept tidy and usable, but mobile polish is not a focus.

---

## 9. Components & files (summary)

**New**
- `src/app/(admin)/layout.tsx` — admin shell
- `src/app/(admin)/admin/page.tsx` — dashboard
- `src/app/(admin)/admin/gyms/[id]/page.tsx` — gym detail + subscription editor
- `src/app/(admin)/admin/gyms/[id]/export/route.ts` — xlsx export
- `src/lib/auth/admin-context.ts` — `getAdminContext()`
- `src/lib/admin/overview.ts` — typed wrapper over `admin_gym_overview()`
- `src/lib/admin/expiry.ts` — `subscriptionExpiryStatus()` (pure)
- `src/lib/admin/export-workbook.ts` — `buildGymWorkbook()` (pure)
- `src/lib/validations/admin.ts` — zod schemas (onboarding, subscription update)
- `src/actions/admin.ts` — `adminCreateGymAction`, `adminUpdateSubscriptionAction`
- `src/components/admin/*` — onboarding form, subscription editor, gyms table (client bits as needed)
- `supabase/migrations/0022_admin_console.sql`

**Changed**
- `src/app/(app)/layout.tsx` — redirect gym-less super_admin to `/admin`
- Remove `src/app/(app)/admin/page.tsx`
- `package.json` — add `exceljs`

---

## 10. Error handling

- Admin guard failure → redirect to `/login` (pages) or `403` JSON (export route).
- Onboarding duplicate email → friendly "An account with this email already exists."
- Onboarding RPC failure after user creation → delete orphan auth user, surface RPC error.
- Export with unknown / no `gym_id` → `404`.
- Empty tables in export → still produce the workbook with header-only sheets.

---

## 11. Testing

Vitest unit tests for the pure logic (matches the repo's TS-only test convention):

- `src/lib/admin/expiry.test.ts` — `subscriptionExpiryStatus`: expired (past), expiring_soon (within 14 days), active (beyond), and null period-end.
- `src/lib/admin/export-workbook.test.ts` — `buildGymWorkbook` with sample data produces the expected sheet names, headers, and row counts.

SQL RPC correctness (`admin_gym_overview`, `admin_create_gym_with_owner`) is verified manually against a local/staging Supabase, consistent with how existing migrations are validated.

---

## 12. Security notes

- All admin surfaces are gated three ways: middleware (edge), `getAdminContext()` (in-process), and RLS / `SECURITY DEFINER` guards (database). RLS remains the real boundary.
- `SECURITY DEFINER` functions check `current_role_name() = 'super_admin'` from the verified JWT before doing anything.
- The owner's initial password is provided by the operator and stored only by Supabase Auth (hashed); the app never persists it. Onboarding uses the service-role client server-side only.
