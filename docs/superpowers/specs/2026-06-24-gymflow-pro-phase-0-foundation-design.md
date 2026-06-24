# GymFlow Pro — Phase 0: Foundation (Design Spec)

**Date:** 2026-06-24
**Status:** Approved for planning
**Author:** GymFlow Pro build session
**Scope:** Phase 0 only (foundation). Later phases referenced for context but NOT specified here.

---

## 1. Product context

GymFlow Pro is a multi-tenant SaaS for gym owners to manage members, memberships,
payments, attendance, communications, and reporting. It is sold to many independent
gyms; each gym's data must be strictly isolated from every other gym's.

This document specifies **Phase 0: the Foundation** — the load-bearing layer that
every later feature depends on. Getting multi-tenancy, RLS, and auth right here is
the single most important correctness decision in the whole product, because every
later table and feature inherits this isolation model.

### Phased roadmap (context only — only Phase 0 is in scope for this spec)

| Phase | Slice |
|------|-------|
| **0** | Scaffold, Supabase schema + RLS, auth, RBAC, multi-tenant app shell, light/dark theme |
| 1 | Member management (CRUD, search/filter, photo, BMI) |
| 2 | Membership plans + expiry engine + status logic |
| 3 | Payments + invoices |
| 4 | Email automation (Resend) + cron reminders |
| 5 | Attendance (manual + QR) |
| 6 | Dashboard + charts |
| 7 | Body progress, notifications, reports/export |
| 8 | Super-admin + subscription plan enforcement |

Each later phase gets its own spec → plan → implementation cycle.

---

## 2. Technology stack (locked)

- **Frontend:** Next.js 16 (App Router; `create-next-app@latest` — supersedes the
  brief's "Next.js 15", which is fully forward-compatible), TypeScript, Tailwind CSS v4,
  shadcn/ui, Framer Motion
- **Forms/validation:** React Hook Form + Zod
- **Backend:** Next.js Server Actions
- **Data/auth:** Supabase (PostgreSQL, Auth, RLS, Storage), `@supabase/ssr`
- **Email (later phases):** Resend
- **Deploy (later):** Vercel + Supabase

---

## 3. Location & project layout

Project root: `C:\Users\Anshu\ANSHU\PROJECTS\gymflow-pro\`

(The stray `package.json` / `node_modules` at `PROJECTS\` root — left over from an
earlier `framer-motion` test install — are unrelated and will be left untouched or
cleaned separately.)

```
gymflow-pro/
├─ docs/superpowers/specs/        # design specs (this file)
├─ supabase/
│  └─ migrations/                 # SQL migrations (versioned)
├─ src/
│  ├─ app/
│  │  ├─ (auth)/                  # public: login, signup, accept-invite
│  │  ├─ (app)/                   # authed: dashboard, admin
│  │  │  ├─ dashboard/
│  │  │  └─ admin/
│  │  ├─ layout.tsx
│  │  └─ globals.css
│  ├─ components/
│  │  ├─ ui/                      # shadcn primitives
│  │  ├─ layout/                  # sidebar, topbar, theme toggle
│  │  └─ auth/                    # auth forms
│  ├─ lib/
│  │  ├─ supabase/                # server, client, middleware helpers
│  │  ├─ auth/                    # role helpers, guards
│  │  └─ validations/             # Zod schemas
│  ├─ actions/                    # server actions (signup, invite, etc.)
│  ├─ types/                      # shared TS types, DB types
│  └─ middleware.ts               # route protection + session refresh
├─ .env.example
├─ README.md                      # Supabase + local setup steps
└─ package.json
```

---

## 4. Multi-tenancy & data isolation model

**Pattern:** single shared Postgres DB; every tenant-scoped table carries a
`gym_id uuid` column; **Row Level Security** is enabled on every such table and
enforces `gym_id = <caller's gym>`. Super Admin bypasses isolation via an explicit
role check in policy logic.

### RLS strategy (DECIDED: Option A — JWT custom claims)

A Supabase **custom access token hook** (a Postgres function registered as an auth
hook) injects two custom claims into every user's JWT at login/refresh:

- `gym_id` — the tenant the user belongs to
- `user_role` — one of `super_admin | gym_owner | staff`

RLS policies read these directly from the verified JWT:

```sql
-- helper accessors (STABLE, read from JWT, no table lookup)
create or replace function auth.current_gym_id() returns uuid
  language sql stable as $$ select nullif(auth.jwt()->>'gym_id','')::uuid $$;

create or replace function auth.current_role_name() returns text
  language sql stable as $$ select auth.jwt()->>'user_role' $$;
```

This gives **zero extra queries per RLS check** and is the cleanest model to scale.
The hook function reads the user's `profiles` row once at token issuance.

**Trade-off accepted:** one extra Postgres hook function to configure in Supabase,
versus a per-check lookup (Option B). Chosen for performance and clean policies.

---

## 5. Phase 0 database schema

Only foundation tables are created in Phase 0. Feature tables (`members`,
`payments`, `attendance`, `membership_plans`, `body_measurements`,
`notifications`, `email_logs`) arrive with their respective phases, each carrying
`gym_id` + RLS following the same pattern established here.

### Enums

```sql
create type app_role   as enum ('super_admin', 'gym_owner', 'staff');
create type sub_plan    as enum ('starter', 'professional', 'enterprise');
create type sub_status  as enum ('trialing', 'active', 'past_due', 'canceled');
```

### Tables

**`gyms`** — tenant root
- `id uuid pk default gen_random_uuid()`
- `name text not null`
- `slug text unique not null`
- `owner_id uuid` (FK → profiles, set after owner created)
- `created_at timestamptz default now()`

**`profiles`** — links `auth.users` → gym + role (1 row per auth user)
- `id uuid pk` references `auth.users(id)` on delete cascade
- `gym_id uuid` references `gyms(id)` on delete cascade  (nullable only for super_admin)
- `role app_role not null default 'staff'`
- `full_name text`
- `email text not null`
- `created_at timestamptz default now()`
- index on `gym_id`

**`subscriptions`** — one per gym
- `id uuid pk`
- `gym_id uuid unique not null` references `gyms(id)` on delete cascade
- `plan sub_plan not null default 'starter'`
- `status sub_status not null default 'trialing'`
- `current_period_end timestamptz`
- `created_at timestamptz default now()`

**`audit_logs`** — security/audit trail
- `id bigint generated always as identity pk`
- `gym_id uuid` references `gyms(id)` on delete cascade
- `actor_id uuid` references `profiles(id)`
- `action text not null`
- `entity text`
- `entity_id text`
- `metadata jsonb`
- `created_at timestamptz default now()`
- index on `(gym_id, created_at desc)`

### RLS policies (pattern, applied to all tenant tables)

```sql
alter table <t> enable row level security;

-- read/write within own gym; super_admin sees all
create policy tenant_select on <t> for select using (
  auth.current_role_name() = 'super_admin'
  or gym_id = auth.current_gym_id()
);
-- analogous insert/update/delete policies, with owner/staff write rules
```

Write policies additionally restrict by role where relevant (e.g., only
`gym_owner`/`super_admin` may modify `subscriptions`; staff is read-mostly). The
exact per-table write matrix is finalized in the implementation plan.

---

## 6. Authentication & RBAC flow

### Sign up (new gym)
A server action runs a single transaction:
1. `supabase.auth.signUp(email, password)` → creates `auth.users` row
2. insert `gyms` row
3. insert `profiles` row (`role = 'gym_owner'`, linked to the new gym)
4. set `gyms.owner_id`
5. insert `subscriptions` row (`starter` / `trialing`)
6. write `audit_logs` entry

If any step fails, the whole thing rolls back (RPC `create_gym_with_owner` in
Postgres for atomicity).

### Invite staff
- Owner submits an email → server action uses Supabase Admin invite (or a signed
  invite token) scoped to the owner's `gym_id` with `role = 'staff'`.
- Invitee sets password on an `/accept-invite` page → `profiles` row created.

### Login & routing
- Standard email/password login.
- Access-token hook stamps `gym_id` + `user_role` claims.
- Post-login redirect by role: `super_admin → /admin`, others → `/dashboard`.

### Guards (defense in depth)
- `middleware.ts`: refreshes session, blocks unauthenticated access to `(app)`
  routes, and blocks non-super-admins from `/admin`.
- **Every server action re-checks role server-side** — the middleware/UI is never
  the security boundary; RLS + server-side role checks are.

---

## 7. App shell & UI (visible result of Phase 0)

- Themed shell: collapsible sidebar + topbar, **light/dark toggle** (next-themes),
  glassmorphism design tokens (translucent panels, backdrop blur, soft borders).
- shadcn/ui installed and themed; base tokens defined for both modes.
- Framer Motion wired for route/element transitions (respecting
  `prefers-reduced-motion`).
- Pages: `/login`, `/signup`, `/accept-invite`, and authed-but-empty `/dashboard`
  and `/admin` (placeholder content — real widgets come in Phase 6/8).

UI quality references (per product brief): Stripe, Linear, Notion, Shopify.

---

## 8. Error handling & validation

- All form input validated with **Zod** on both client (RHF resolver) and server
  (re-parse inside the server action — never trust client).
- Server actions return a typed `{ ok: true, data } | { ok: false, error }` result;
  forms surface field + form-level errors.
- Auth/DB errors mapped to safe, user-readable messages (no raw Postgres/Supabase
  errors leaked to the client).
- Audit log entries written for security-relevant actions (signup, invite, role
  changes).

---

## 9. Security (Phase 0 baseline)

- **RBAC:** roles enforced at RLS + server action layers.
- **Tenant isolation:** RLS on every tenant table (proven by verification, §10).
- **Input validation:** Zod everywhere.
- **Session security:** `@supabase/ssr` httpOnly cookies, middleware refresh.
- **Audit logs:** foundational table + writes on security events.
- (Rate limiting, secure file uploads come with the phases that introduce those
  surfaces — Phase 1 uploads, Phase 4 email send.)

---

## 10. Definition of done & verification

Phase 0 is complete when:
1. `npm run dev` starts the app with no type/lint errors.
2. Sign-up creates a gym + owner + subscription atomically (verified by querying
   the three rows).
3. Login lands the user on a themed `/dashboard`; super_admin lands on `/admin`.
4. **Tenant isolation is proven:** with two gyms seeded, a query as gym A's user
   returns zero of gym B's rows (demonstrated via a Supabase SQL/REST check).
5. Light/dark toggle works and persists.
6. `.env.example` + README let a fresh clone reach a running app using the user's
   own Supabase project.

Automated tests: server actions and Zod schemas covered by unit tests where they
carry logic; the RLS isolation check is scripted as a repeatable verification.

---

## 11. Open items to resolve in the implementation plan

- Exact per-table write-policy matrix (owner vs staff capabilities).
- Whether staff invites use Supabase's built-in invite email (needs Resend/SMTP)
  or a self-set-password token flow for Phase 0 (email arrives Phase 4).
- Seed/fixture strategy for the two-gym isolation test.

---

## 12. Out of scope for Phase 0 (explicitly deferred)

Member CRUD, membership plans, expiry engine, payments, attendance, body progress,
notifications center, reports/exports, dashboard charts, Resend email automation,
cron jobs, super-admin analytics, subscription billing enforcement. Each lands in
its named phase with its own spec.
