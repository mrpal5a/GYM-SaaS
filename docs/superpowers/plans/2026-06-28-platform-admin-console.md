# Platform Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `super_admin`-only console to view every gym with its stats, onboard new gym+owner accounts, manage each gym's SaaS subscription, and export a gym's full data to Excel.

**Architecture:** A new `(admin)` route group with its own minimal shell, gated by a `getAdminContext()` guard (mirroring `getGymContext`). Per-gym aggregates come from one `SECURITY DEFINER` SQL function; onboarding uses the service-role client + an atomic `SECURITY DEFINER` RPC; export streams an `.xlsx` built by a pure, unit-tested workbook builder.

**Tech Stack:** Next.js 16 (App Router, server components + server actions), Supabase (Postgres + RLS + JWT claims), React 19 `useActionState`, Zod, ExcelJS, Vitest, Tailwind + existing UI primitives.

**Spec:** `docs/superpowers/specs/2026-06-28-platform-admin-console-design.md`

**Conventions to follow (verified in codebase):**
- Server actions return `type ActionResult = { ok: false; error: string } | { ok: true }` (see `src/actions/auth.ts`).
- Forms are client components using `useActionState(action, null)` (see `src/components/auth/invite-form.tsx`).
- Service-role ops use `createAdminClient()` from `src/lib/supabase/admin.ts`.
- `SECURITY DEFINER` functions check `public.current_role_name() = 'super_admin'` and `grant execute ... to authenticated` (see `0004_create_gym_with_owner.sql`).
- Money via `formatMoney()`, dates via `formatDate()` from `src/lib/members/metrics.ts`.
- Links styled as buttons use `buttonVariants({ variant, size })` from `src/components/ui/button.tsx`.
- Tests: Vitest, `npm test` (run once) / `npm run test:watch`. Pure-logic only, colocated `*.test.ts` (see `src/lib/validations/gym.test.ts`).

---

## File Structure

**New files**
- `supabase/migrations/0022_admin_console.sql` — `admin_gym_overview()` + `admin_create_gym_with_owner()`
- `src/lib/auth/admin-context.ts` — `getAdminContext()` guard
- `src/lib/admin/expiry.ts` + `expiry.test.ts` — `subscriptionExpiryStatus()` (pure)
- `src/lib/admin/overview.ts` — `GymOverviewRow` type + `getGymOverview()` wrapper
- `src/lib/admin/export-workbook.ts` + `export-workbook.test.ts` — `buildGymWorkbook()` (pure)
- `src/lib/validations/admin.ts` + `admin.test.ts` — onboarding + subscription Zod schemas
- `src/actions/admin.ts` — `adminCreateGymAction`, `adminUpdateSubscriptionAction`
- `src/app/(admin)/layout.tsx` — admin shell
- `src/app/(admin)/admin/page.tsx` — gyms dashboard
- `src/app/(admin)/admin/gyms/new/page.tsx` — onboarding form page
- `src/app/(admin)/admin/gyms/[id]/page.tsx` — gym detail + subscription editor
- `src/app/(admin)/admin/gyms/[id]/export/route.ts` — xlsx export route
- `src/components/admin/onboard-gym-form.tsx` — onboarding form (client)
- `src/components/admin/subscription-editor.tsx` — subscription editor (client)
- `src/components/admin/expiry-badge.tsx` — expiry badge (server-safe)

**Modified files**
- `src/types/db.ts` — add `SubPlan`, `SubStatus`, `Subscription`
- `src/app/(app)/layout.tsx` — redirect gym-less `super_admin` to `/admin`
- `package.json` — add `exceljs`

**Removed files**
- `src/app/(app)/admin/page.tsx` — placeholder replaced by `(admin)` group

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/0022_admin_console.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0022_admin_console.sql`:

```sql
-- 0022_admin_console.sql
-- Phase 8 super-admin console: cross-tenant overview + admin onboarding RPC.
-- Both functions are SECURITY DEFINER and self-guard to super_admin.

-- Per-gym overview for the admin dashboard (one row per gym, no N+1).
create or replace function public.admin_gym_overview()
returns table (
  gym_id              uuid,
  name                text,
  slug                text,
  owner_name          text,
  owner_email         text,
  member_count        bigint,
  revenue_total       numeric,
  revenue_this_month  numeric,
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

-- Wire up gym + owner profile + subscription for an already-created auth user.
-- The auth user is created by the service-role client in the server action; this
-- function only touches app tables, atomically, after a super_admin check.
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

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: applies `0022_admin_console.sql` with no errors. (If `supabase` isn't linked, the engineer applies the SQL via the Supabase SQL editor — see `README.md`.)

- [ ] **Step 3: Smoke-test the guard (manual, optional)**

In the Supabase SQL editor as a non-super_admin, `select * from admin_gym_overview();` should raise `forbidden: super_admin only`. As super_admin it returns one row per gym.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0022_admin_console.sql
git commit -m "feat(admin): SQL overview + onboarding RPC for super-admin console"
```

---

## Task 2: Subscription types

**Files:**
- Modify: `src/types/db.ts`

- [ ] **Step 1: Add the SaaS subscription types**

At the end of `src/types/db.ts`, append:

```ts
// SaaS subscription (one per gym). Mirrors public.subscriptions
// (migrations 0001 + 0022). Distinct from member_subscriptions above.
export type SubPlan = "starter" | "professional" | "enterprise";
export type SubStatus = "trialing" | "active" | "past_due" | "canceled";

export interface Subscription {
  id: string;
  gym_id: string;
  plan: SubPlan;
  status: SubStatus;
  current_period_end: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/db.ts
git commit -m "feat(admin): SaaS subscription row types"
```

---

## Task 3: Admin context guard

**Files:**
- Create: `src/lib/auth/admin-context.ts`

- [ ] **Step 1: Write the guard**

Create `src/lib/auth/admin-context.ts`:

```ts
import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface AdminContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}

/**
 * Resolve the caller as a super_admin from the verified JWT. Returns null for
 * anyone else (or no session). Middleware already blocks non-admins from /admin;
 * this is the in-process belt-and-suspenders and yields the Supabase client.
 * RLS / SECURITY DEFINER guards remain the real boundary.
 */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub as string | undefined;
  const role = claims?.user_role as string | undefined;
  if (!userId || role !== "super_admin") return null;
  return { supabase, userId };
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/admin-context.ts
git commit -m "feat(admin): getAdminContext super-admin guard"
```

---

## Task 4: Expiry-status helper (TDD)

**Files:**
- Create: `src/lib/admin/expiry.ts`
- Test: `src/lib/admin/expiry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/admin/expiry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { subscriptionExpiryStatus } from "./expiry";

const NOW = new Date("2026-06-28T12:00:00Z");

describe("subscriptionExpiryStatus", () => {
  it("returns 'expired' when the period end is in the past", () => {
    expect(subscriptionExpiryStatus("2026-06-01T00:00:00Z", NOW)).toBe("expired");
  });

  it("returns 'expiring_soon' within 14 days", () => {
    expect(subscriptionExpiryStatus("2026-07-05T00:00:00Z", NOW)).toBe("expiring_soon");
  });

  it("returns 'active' beyond 14 days", () => {
    expect(subscriptionExpiryStatus("2026-09-01T00:00:00Z", NOW)).toBe("active");
  });

  it("treats the boundary (exactly 14 days out) as expiring_soon", () => {
    expect(subscriptionExpiryStatus("2026-07-12T12:00:00Z", NOW)).toBe("expiring_soon");
  });

  it("returns 'none' when there is no period end", () => {
    expect(subscriptionExpiryStatus(null, NOW)).toBe("none");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/admin/expiry.test.ts`
Expected: FAIL — cannot find module `./expiry`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/admin/expiry.ts`:

```ts
export type ExpiryStatus = "expired" | "expiring_soon" | "active" | "none";

const SOON_DAYS = 14;
const DAY_MS = 86_400_000;

/**
 * Classify a gym's SaaS subscription period-end relative to `now`.
 * - expired:       period end already passed
 * - expiring_soon: within SOON_DAYS (inclusive)
 * - active:        further out
 * - none:          no period end recorded
 */
export function subscriptionExpiryStatus(
  periodEnd: string | null | undefined,
  now: Date = new Date(),
): ExpiryStatus {
  if (!periodEnd) return "none";
  const end = new Date(periodEnd).getTime();
  const diffDays = (end - now.getTime()) / DAY_MS;
  if (diffDays < 0) return "expired";
  if (diffDays <= SOON_DAYS) return "expiring_soon";
  return "active";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/admin/expiry.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/expiry.ts src/lib/admin/expiry.test.ts
git commit -m "feat(admin): subscription expiry-status helper"
```

---

## Task 5: Expiry badge component

**Files:**
- Create: `src/components/admin/expiry-badge.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/admin/expiry-badge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/members/metrics";
import { subscriptionExpiryStatus, type ExpiryStatus } from "@/lib/admin/expiry";

const META: Record<ExpiryStatus, { label: string; tone: "success" | "warning" | "danger" | "muted" }> = {
  active: { label: "Active", tone: "success" },
  expiring_soon: { label: "Expiring soon", tone: "warning" },
  expired: { label: "Expired", tone: "danger" },
  none: { label: "No expiry", tone: "muted" },
};

export function ExpiryBadge({ periodEnd }: { periodEnd: string | null }) {
  const status = subscriptionExpiryStatus(periodEnd);
  const meta = META[status];
  return (
    <span className="inline-flex items-center gap-2">
      <Badge tone={meta.tone}>{meta.label}</Badge>
      {periodEnd && <span className="text-xs text-muted-foreground">{formatDate(periodEnd)}</span>}
    </span>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/expiry-badge.tsx
git commit -m "feat(admin): expiry badge component"
```

---

## Task 6: Overview data wrapper

**Files:**
- Create: `src/lib/admin/overview.ts`

- [ ] **Step 1: Write the wrapper**

Create `src/lib/admin/overview.ts`:

```ts
import "server-only";
import type { SubPlan, SubStatus } from "@/types/db";
import { getAdminContext } from "@/lib/auth/admin-context";

export interface GymOverviewRow {
  gym_id: string;
  name: string;
  slug: string;
  owner_name: string | null;
  owner_email: string | null;
  member_count: number;
  revenue_total: number;
  revenue_this_month: number;
  plan: SubPlan | null;
  status: SubStatus | null;
  current_period_end: string | null;
  created_at: string;
}

/**
 * Cross-tenant gym overview for the admin dashboard. Returns null when the caller
 * is not a super_admin (the RPC also self-guards). Numerics arrive as strings
 * from PostgREST, so coerce them to numbers here.
 */
export async function getGymOverview(): Promise<GymOverviewRow[] | null> {
  const ctx = await getAdminContext();
  if (!ctx) return null;
  const { data, error } = await ctx.supabase.rpc("admin_gym_overview");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: GymOverviewRow) => ({
    ...r,
    member_count: Number(r.member_count),
    revenue_total: Number(r.revenue_total),
    revenue_this_month: Number(r.revenue_this_month),
  }));
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/overview.ts
git commit -m "feat(admin): typed gym-overview RPC wrapper"
```

---

## Task 7: Admin shell layout + remove placeholder

**Files:**
- Create: `src/app/(admin)/layout.tsx`
- Remove: `src/app/(app)/admin/page.tsx`

- [ ] **Step 1: Write the admin shell**

Create `src/app/(admin)/layout.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheckIcon } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { getAdminContext } from "@/lib/auth/admin-context";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass sticky top-0 z-10 flex h-14 items-center justify-between gap-2 px-3 sm:px-4">
        <Link href="/admin" className="flex min-w-0 items-center gap-2.5 font-semibold">
          <ShieldCheckIcon className="size-5 shrink-0 text-primary" />
          <span className="truncate">GymFlow Pro · Admin</span>
        </Link>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">Sign out</Button>
          </form>
        </div>
      </header>
      <main className="min-w-0 flex-1 p-4">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Remove the placeholder admin page**

Run: `git rm src/app/(app)/admin/page.tsx`
Expected: file deleted. `/admin` now resolves through `(admin)/admin/page.tsx` (created next task).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (`/admin` page comes in Task 8; the route is temporarily 404 between commits — acceptable.)

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/layout.tsx
git commit -m "feat(admin): admin shell layout; drop placeholder admin page"
```

---

## Task 8: Gyms dashboard page

**Files:**
- Create: `src/app/(admin)/admin/page.tsx`

- [ ] **Step 1: Write the dashboard page**

Create `src/app/(admin)/admin/page.tsx`:

```tsx
import Link from "next/link";
import { BuildingIcon, UsersIcon, IndianRupeeIcon, DownloadIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ExpiryBadge } from "@/components/admin/expiry-badge";
import { getGymOverview } from "@/lib/admin/overview";
import { formatMoney } from "@/lib/members/metrics";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "muted" | "primary"> = {
  active: "success", trialing: "primary", past_due: "warning", canceled: "danger",
};

export default async function AdminDashboardPage() {
  const gyms = (await getGymOverview()) ?? [];

  const totalMembers = gyms.reduce((s, g) => s + g.member_count, 0);
  const totalRevenue = gyms.reduce((s, g) => s + g.revenue_total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Gyms</h1>
          <p className="text-sm text-muted-foreground">Every gym using GymFlow Pro.</p>
        </div>
        <Link href="/admin/gyms/new" className={buttonVariants({ variant: "default" })}>
          Onboard gym
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Gyms" value={gyms.length} icon={BuildingIcon} />
        <StatCard label="Active members" value={totalMembers} icon={UsersIcon} />
        <StatCard label="Total revenue" value={formatMoney(totalRevenue)} icon={IndianRupeeIcon} />
      </div>

      <Card className="glass">
        <CardHeader><CardTitle>All gyms</CardTitle></CardHeader>
        <CardContent>
          {gyms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gyms yet. Onboard your first gym.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Gym</th>
                    <th className="py-2 pr-3 font-medium">Owner</th>
                    <th className="py-2 pr-3 text-right font-medium">Members</th>
                    <th className="py-2 pr-3 text-right font-medium">Revenue (mo / total)</th>
                    <th className="py-2 pr-3 font-medium">Plan</th>
                    <th className="py-2 pr-3 font-medium">SaaS expiry</th>
                    <th className="py-2 pr-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {gyms.map((g) => (
                    <tr key={g.gym_id} className="border-b last:border-0">
                      <td className="py-2.5 pr-3">
                        <Link href={`/admin/gyms/${g.gym_id}`} className="font-medium hover:underline">
                          {g.name}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="truncate">{g.owner_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{g.owner_email ?? "—"}</div>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{g.member_count}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {formatMoney(g.revenue_this_month)}
                        <span className="text-muted-foreground"> / {formatMoney(g.revenue_total)}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        {g.plan ? <Badge tone={STATUS_TONE[g.status ?? "muted"] ?? "muted"}>{g.plan}</Badge> : "—"}
                      </td>
                      <td className="py-2.5 pr-3"><ExpiryBadge periodEnd={g.current_period_end} /></td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/admin/gyms/${g.gym_id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                            Manage
                          </Link>
                          <a href={`/admin/gyms/${g.gym_id}/export`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                            <DownloadIcon /> Data
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verify**

Run `npm run dev`, log in as a super_admin, visit `/admin`. Expected: summary cards + a table of gyms (or the empty state). Non-admins hitting `/admin` are redirected to `/dashboard` by middleware.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/admin/page.tsx
git commit -m "feat(admin): gyms dashboard with stats table"
```

---

## Task 9: Onboarding + subscription validation schemas (TDD)

**Files:**
- Create: `src/lib/validations/admin.ts`
- Test: `src/lib/validations/admin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/validations/admin.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { onboardGymSchema, updateSubscriptionSchema } from "./admin";

describe("onboardGymSchema", () => {
  const ok = {
    gymName: "Iron Paradise", ownerFullName: "Asha Rao",
    email: "asha@example.com", password: "secret12",
    plan: "professional", periodEnd: "2026-12-31",
  };

  it("accepts a valid payload", () => {
    expect(onboardGymSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects a short password", () => {
    expect(onboardGymSchema.safeParse({ ...ok, password: "short" }).success).toBe(false);
  });

  it("rejects a bad email", () => {
    expect(onboardGymSchema.safeParse({ ...ok, email: "nope" }).success).toBe(false);
  });

  it("rejects an unknown plan", () => {
    expect(onboardGymSchema.safeParse({ ...ok, plan: "gold" }).success).toBe(false);
  });
});

describe("updateSubscriptionSchema", () => {
  it("accepts a valid update", () => {
    const r = updateSubscriptionSchema.safeParse({
      plan: "starter", status: "active", periodEnd: "2027-01-01",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(updateSubscriptionSchema.safeParse({
      plan: "starter", status: "frozen", periodEnd: "2027-01-01",
    }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/validations/admin.test.ts`
Expected: FAIL — cannot find module `./admin`.

- [ ] **Step 3: Write the schemas**

Create `src/lib/validations/admin.ts`:

```ts
import { z } from "zod";

const plan = z.enum(["starter", "professional", "enterprise"]);
const status = z.enum(["trialing", "active", "past_due", "canceled"]);

export const onboardGymSchema = z.object({
  gymName: z.string().min(2, "Gym name too short").max(120),
  ownerFullName: z.string().min(1, "Required").max(120),
  email: z.email(),
  password: z.string().min(8, "Min 8 characters").max(72),
  plan,
  periodEnd: z.string().min(1, "Pick an expiry date"),
});

export const updateSubscriptionSchema = z.object({
  plan,
  status,
  periodEnd: z.string().min(1, "Pick an expiry date"),
});

export type OnboardGymInput = z.infer<typeof onboardGymSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/validations/admin.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/admin.ts src/lib/validations/admin.test.ts
git commit -m "feat(admin): onboarding + subscription Zod schemas"
```

---

## Task 10: Admin server actions

**Files:**
- Create: `src/actions/admin.ts`

- [ ] **Step 1: Write the actions**

Create `src/actions/admin.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/auth/admin-context";
import { onboardGymSchema, updateSubscriptionSchema } from "@/lib/validations/admin";
import { slugify } from "@/lib/validations/auth";

type ActionResult = { ok: false; error: string } | { ok: true };

export async function adminCreateGymAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, error: "Not authorized" };

  const parsed = onboardGymSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { gymName, ownerFullName, email, password, plan, periodEnd } = parsed.data;

  const admin = createAdminClient();
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (userErr || !created.user) {
    return { ok: false, error: userErr?.message ?? "Could not create the owner account" };
  }

  const userId = created.user.id;
  const slug = `${slugify(gymName)}-${userId.slice(0, 6)}`;
  const { error: rpcErr } = await ctx.supabase.rpc("admin_create_gym_with_owner", {
    p_user_id: userId, p_email: email, p_full_name: ownerFullName,
    p_gym_name: gymName, p_slug: slug, p_plan: plan,
    p_period_end: new Date(periodEnd).toISOString(),
  });
  if (rpcErr) {
    // Roll back the orphaned auth user so the email can be retried.
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: rpcErr.message };
  }

  revalidatePath("/admin");
  redirect("/admin");
}

export async function adminUpdateSubscriptionAction(
  gymId: string, _prev: unknown, formData: FormData,
): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, error: "Not authorized" };

  const parsed = updateSubscriptionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { plan, status, periodEnd } = parsed.data;

  const { error } = await ctx.supabase
    .from("subscriptions")
    .update({ plan, status, current_period_end: new Date(periodEnd).toISOString() })
    .eq("gym_id", gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/gyms/${gymId}`);
  revalidatePath("/admin");
  return { ok: true };
}
```

> Note: `redirect()` throws a control-flow signal; that's expected inside a server action and is how the form navigates on success.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/actions/admin.ts
git commit -m "feat(admin): onboard-gym + update-subscription server actions"
```

---

## Task 11: Onboarding form + page

**Files:**
- Create: `src/components/admin/onboard-gym-form.tsx`
- Create: `src/app/(admin)/admin/gyms/new/page.tsx`

- [ ] **Step 1: Write the form component**

Create `src/components/admin/onboard-gym-form.tsx`:

```tsx
"use client";
import { useActionState } from "react";
import { adminCreateGymAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function OnboardGymForm() {
  const [state, action, pending] = useActionState(adminCreateGymAction, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="gymName">Gym name</Label>
          <Input id="gymName" name="gymName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ownerFullName">Owner name</Label>
          <Input id="ownerFullName" name="ownerFullName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Owner email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Initial password</Label>
          <Input id="password" name="password" type="text" minLength={8} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan">Plan</Label>
          <Select id="plan" name="plan" defaultValue="starter">
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="periodEnd">SaaS expiry date</Label>
          <Input id="periodEnd" name="periodEnd" type="date" required />
        </div>
      </div>
      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create gym & owner"}</Button>
    </form>
  );
}
```

> `password` uses `type="text"` deliberately: the operator sets and reads the credential to hand over. Change to `type="password"` if you prefer it masked.

- [ ] **Step 2: Write the page**

Create `src/app/(admin)/admin/gyms/new/page.tsx`:

```tsx
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardGymForm } from "@/components/admin/onboard-gym-form";

export default function NewGymPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← Back to gyms</Link>
      <Card className="glass">
        <CardHeader>
          <CardTitle>Onboard a gym</CardTitle>
          <p className="text-sm text-muted-foreground">
            Create the gym and its owner account. Share the email and password with the owner.
          </p>
        </CardHeader>
        <CardContent><OnboardGymForm /></CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verify**

`npm run dev` → `/admin/gyms/new` as super_admin → fill the form → submit. Expected: redirect to `/admin` with the new gym listed; logging in with the new owner's email+password lands on `/dashboard`.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/onboard-gym-form.tsx src/app/\(admin\)/admin/gyms/new/page.tsx
git commit -m "feat(admin): gym onboarding form + page"
```

---

## Task 12: Gym detail page + subscription editor

**Files:**
- Create: `src/components/admin/subscription-editor.tsx`
- Create: `src/app/(admin)/admin/gyms/[id]/page.tsx`

- [ ] **Step 1: Write the subscription editor**

Create `src/components/admin/subscription-editor.tsx`:

```tsx
"use client";
import { useActionState } from "react";
import { adminUpdateSubscriptionAction } from "@/actions/admin";
import type { Subscription } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function SubscriptionEditor({ gymId, sub }: { gymId: string; sub: Subscription | null }) {
  const action = adminUpdateSubscriptionAction.bind(null, gymId);
  const [state, formAction, pending] = useActionState(action, null);
  const periodEnd = sub?.current_period_end ? sub.current_period_end.slice(0, 10) : "";

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="plan">Plan</Label>
          <Select id="plan" name="plan" defaultValue={sub?.plan ?? "starter"}>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={sub?.status ?? "active"}>
            <option value="trialing">Trialing</option>
            <option value="active">Active</option>
            <option value="past_due">Past due</option>
            <option value="canceled">Canceled</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="periodEnd">Expiry date</Label>
          <Input id="periodEnd" name="periodEnd" type="date" defaultValue={periodEnd} required />
        </div>
      </div>
      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.ok === true && <p className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</p>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save subscription"}</Button>
    </form>
  );
}
```

- [ ] **Step 2: Write the gym detail page**

Create `src/app/(admin)/admin/gyms/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { SubscriptionEditor } from "@/components/admin/subscription-editor";
import { getAdminContext } from "@/lib/auth/admin-context";
import { formatMoney } from "@/lib/members/metrics";
import type { Gym, Subscription } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function AdminGymDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx) notFound();

  const [{ data: gym }, { data: sub }, { count: memberCount }, { data: payments }] = await Promise.all([
    ctx.supabase.from("gyms").select("*").eq("id", id).maybeSingle(),
    ctx.supabase.from("subscriptions").select("*").eq("gym_id", id).maybeSingle(),
    ctx.supabase.from("members").select("id", { count: "exact", head: true }).eq("gym_id", id).eq("is_active", true),
    ctx.supabase.from("payments").select("amount").eq("gym_id", id),
  ]);

  if (!gym) notFound();
  const g = gym as Gym;
  const revenueTotal = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← Back to gyms</Link>

      <Card className="glass">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle>{g.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{g.slug}</p>
          </div>
          <a href={`/admin/gyms/${id}/export`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <DownloadIcon /> Download data
          </a>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div><span className="text-muted-foreground">Active members:</span> {memberCount ?? 0}</div>
          <div><span className="text-muted-foreground">Total revenue:</span> {formatMoney(revenueTotal)}</div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle>SaaS subscription</CardTitle></CardHeader>
        <CardContent>
          <SubscriptionEditor gymId={id} sub={(sub as Subscription | null) ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verify**

`/admin/gyms/<id>` as super_admin → shows stats + subscription editor. Change plan/status/expiry → Save → "Saved." and `/admin` reflects the new expiry badge.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/subscription-editor.tsx src/app/\(admin\)/admin/gyms/\[id\]/page.tsx
git commit -m "feat(admin): gym detail page + subscription editor"
```

---

## Task 13: Excel workbook builder (TDD)

**Files:**
- Modify: `package.json` (add `exceljs`)
- Create: `src/lib/admin/export-workbook.ts`
- Test: `src/lib/admin/export-workbook.test.ts`

- [ ] **Step 1: Add the dependency**

Run: `npm install exceljs`
Expected: `exceljs` added to `dependencies`.

- [ ] **Step 2: Write the failing test**

Create `src/lib/admin/export-workbook.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildGymWorkbook, type GymExportData } from "./export-workbook";

const data: GymExportData = {
  gym: { name: "Iron Paradise", slug: "iron-paradise-abc123", created_at: "2026-01-01T00:00:00Z" },
  subscription: { plan: "professional", status: "active", current_period_end: "2026-12-31T00:00:00Z" },
  members: [
    { full_name: "Asha Rao", email: "asha@example.com", phone: "999", gender: "female",
      date_of_birth: "1990-01-01", joined_at: "2026-01-02", is_active: true, created_at: "2026-01-02T00:00:00Z" },
  ],
  plans: [
    { name: "Monthly", description: null, price: 1000, duration_days: 30, is_active: true, created_at: "2026-01-01T00:00:00Z" },
  ],
  subscriptions: [
    { member_name: "Asha Rao", plan_name: "Monthly", start_date: "2026-01-02", end_date: "2026-02-01", status: "active" },
  ],
  payments: [
    { member_name: "Asha Rao", amount: 1000, method: "cash", invoice_number: "INV-1", paid_at: "2026-01-02T00:00:00Z", note: null },
  ],
};

describe("buildGymWorkbook", () => {
  it("creates the five expected sheets", () => {
    const wb = buildGymWorkbook(data);
    expect(wb.worksheets.map((w) => w.name)).toEqual(
      ["Gym Info", "Members", "Plans", "Subscriptions", "Payments"],
    );
  });

  it("writes a header row plus one data row in Members", () => {
    const wb = buildGymWorkbook(data);
    const ws = wb.getWorksheet("Members")!;
    expect(ws.getRow(1).getCell(1).value).toBe("Full name");
    expect(ws.getRow(2).getCell(1).value).toBe("Asha Rao");
    expect(ws.rowCount).toBe(2);
  });

  it("lists the payment amount", () => {
    const wb = buildGymWorkbook(data);
    const ws = wb.getWorksheet("Payments")!;
    expect(ws.getRow(2).getCell(2).value).toBe(1000);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/lib/admin/export-workbook.test.ts`
Expected: FAIL — cannot find module `./export-workbook`.

- [ ] **Step 4: Write the builder**

Create `src/lib/admin/export-workbook.ts`:

```ts
import ExcelJS from "exceljs";

export interface GymExportData {
  gym: { name: string; slug: string; created_at: string };
  subscription: { plan: string; status: string; current_period_end: string | null } | null;
  members: Array<{
    full_name: string; email: string | null; phone: string | null; gender: string | null;
    date_of_birth: string | null; joined_at: string; is_active: boolean; created_at: string;
  }>;
  plans: Array<{
    name: string; description: string | null; price: number; duration_days: number;
    is_active: boolean; created_at: string;
  }>;
  subscriptions: Array<{
    member_name: string | null; plan_name: string; start_date: string; end_date: string; status: string;
  }>;
  payments: Array<{
    member_name: string | null; amount: number; method: string;
    invoice_number: string | null; paid_at: string; note: string | null;
  }>;
}

function addSheet(
  wb: ExcelJS.Workbook,
  name: string,
  headers: string[],
  rows: Array<Array<string | number | boolean | null>>,
) {
  const ws = wb.addWorksheet(name);
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(r);
  ws.columns.forEach((c) => { c.width = 18; });
  return ws;
}

/** Build a multi-tab workbook of one gym's data. Pure — no IO. */
export function buildGymWorkbook(data: GymExportData): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();

  addSheet(wb, "Gym Info", ["Field", "Value"], [
    ["Name", data.gym.name],
    ["Slug", data.gym.slug],
    ["Created", data.gym.created_at],
    ["Plan", data.subscription?.plan ?? "—"],
    ["Status", data.subscription?.status ?? "—"],
    ["SaaS expiry", data.subscription?.current_period_end ?? "—"],
  ]);

  addSheet(wb, "Members",
    ["Full name", "Email", "Phone", "Gender", "Date of birth", "Joined", "Active", "Created"],
    data.members.map((m) => [
      m.full_name, m.email, m.phone, m.gender, m.date_of_birth, m.joined_at, m.is_active, m.created_at,
    ]),
  );

  addSheet(wb, "Plans",
    ["Name", "Description", "Price", "Duration (days)", "Active", "Created"],
    data.plans.map((p) => [p.name, p.description, p.price, p.duration_days, p.is_active, p.created_at]),
  );

  addSheet(wb, "Subscriptions",
    ["Member", "Plan", "Start", "End", "Status"],
    data.subscriptions.map((s) => [s.member_name, s.plan_name, s.start_date, s.end_date, s.status]),
  );

  addSheet(wb, "Payments",
    ["Member", "Amount", "Method", "Invoice #", "Paid at", "Note"],
    data.payments.map((p) => [p.member_name, p.amount, p.method, p.invoice_number, p.paid_at, p.note]),
  );

  return wb;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/admin/export-workbook.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/admin/export-workbook.ts src/lib/admin/export-workbook.test.ts
git commit -m "feat(admin): Excel workbook builder for gym data export"
```

---

## Task 14: Export route handler

**Files:**
- Create: `src/app/(admin)/admin/gyms/[id]/export/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/(admin)/admin/gyms/[id]/export/route.ts`:

```ts
import { getAdminContext } from "@/lib/auth/admin-context";
import { buildGymWorkbook, type GymExportData } from "@/lib/admin/export-workbook";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx) return new Response("Forbidden", { status: 403 });

  const [{ data: gym }, { data: sub }, { data: members }, { data: plans }, { data: subs }, { data: payments }] =
    await Promise.all([
      ctx.supabase.from("gyms").select("name, slug, created_at").eq("id", id).maybeSingle(),
      ctx.supabase.from("subscriptions").select("plan, status, current_period_end").eq("gym_id", id).maybeSingle(),
      ctx.supabase.from("members")
        .select("full_name, email, phone, gender, date_of_birth, joined_at, is_active, created_at").eq("gym_id", id),
      ctx.supabase.from("membership_plans")
        .select("name, description, price, duration_days, is_active, created_at").eq("gym_id", id),
      ctx.supabase.from("member_subscriptions")
        .select("plan_name, start_date, end_date, status, members(full_name)").eq("gym_id", id),
      ctx.supabase.from("payments")
        .select("member_name, amount, method, invoice_number, paid_at, note").eq("gym_id", id),
    ]);

  if (!gym) return new Response("Not found", { status: 404 });

  const data: GymExportData = {
    gym: gym as GymExportData["gym"],
    subscription: (sub as GymExportData["subscription"]) ?? null,
    members: (members ?? []) as GymExportData["members"],
    plans: (plans ?? []) as GymExportData["plans"],
    subscriptions: (subs ?? []).map((s: { plan_name: string; start_date: string; end_date: string; status: string; members: { full_name: string } | null }) => ({
      member_name: s.members?.full_name ?? null,
      plan_name: s.plan_name, start_date: s.start_date, end_date: s.end_date, status: s.status,
    })),
    payments: (payments ?? []) as GymExportData["payments"],
  };

  const wb = buildGymWorkbook(data);
  const buffer = await wb.xlsx.writeBuffer();
  const today = new Date().toISOString().slice(0, 10);
  const filename = `${(gym as { slug: string }).slug}-export-${today}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

> `member_subscriptions` has no `member_name` column, so we join `members(full_name)` and flatten it. `payments` already snapshots `member_name`, so it's selected directly.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (If the `members(full_name)` join types as an array, change the map param to `members: { full_name: string }[] | null` and read `s.members?.[0]?.full_name`.)

- [ ] **Step 3: Manual verify**

As super_admin, click "Download data" on `/admin` or the gym detail page. Expected: an `.xlsx` downloads with tabs Gym Info / Members / Plans / Subscriptions / Payments, populated for that gym. As a non-admin, requesting the URL returns 403.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/admin/gyms/\[id\]/export/route.ts
git commit -m "feat(admin): per-gym Excel export route"
```

---

## Task 15: Redirect gym-less super_admin away from the gym shell

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Add the redirect**

In `src/app/(app)/layout.tsx`, add imports and an early check at the top of `AppLayout`, before the existing `Promise.all`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
// ...existing imports...

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // A super_admin has no gym; send them to their console instead of an empty shell.
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (claimsData?.claims?.user_role === "super_admin") redirect("/admin");

  const [branding, ctx] = await Promise.all([getGymBranding(), getGymContext()]);
  // ...rest unchanged...
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verify**

As super_admin, visiting `/dashboard` (or any `(app)` route) redirects to `/admin`. Gym owners and staff are unaffected.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/layout.tsx
git commit -m "feat(admin): redirect gym-less super_admin to /admin"
```

---

## Task 16: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new `expiry`, `admin` validations, and `export-workbook` suites.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `(admin)` routes appear in the route manifest.

- [ ] **Step 4: End-to-end manual smoke (as super_admin)**

1. `/admin` lists gyms with stats.
2. `/admin/gyms/new` creates a gym + owner; new owner can log in.
3. `/admin/gyms/<id>` edits the subscription; the expiry badge updates on `/admin`.
4. "Download data" yields a populated `.xlsx`.
5. A gym owner / staff account cannot reach `/admin` (redirected) and gets 403 on the export URL.

- [ ] **Step 5: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "chore(admin): verification fixes for platform admin console"
```

---

## Notes & deferred work

- **Out of scope (per spec):** automated SaaS billing, plan *enforcement* (locking out `past_due`/expired gyms), owner email notifications, gym suspension/deletion. Each is a future slice.
- **Provisioning a first super_admin:** this plan does not create the initial admin account. Promote a user once via SQL: `update public.profiles set role = 'super_admin', gym_id = null where email = '<you>';` then have them sign out/in so the JWT re-stamps `user_role`.
- **Timezone:** `revenue_this_month` and expiry use server time (UTC). Acceptable for an operator overview; revisit if per-gym timezone reporting is ever needed.
