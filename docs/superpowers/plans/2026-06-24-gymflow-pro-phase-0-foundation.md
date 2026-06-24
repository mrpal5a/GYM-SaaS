# GymFlow Pro — Phase 0: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the load-bearing foundation of GymFlow Pro — a multi-tenant Next.js 15 + Supabase app with JWT-claim-based RLS isolation, role-based auth, and a themed (light/dark) app shell — verifiably isolating each gym's data.

**Architecture:** Single Postgres DB with `gym_id` on every tenant table and Row Level Security enforced from JWT custom claims (`gym_id`, `user_role`) injected by a Supabase access-token hook. Next.js App Router with `@supabase/ssr` cookie auth, server actions for all mutations (re-validated with Zod server-side), and middleware route guards as defense-in-depth on top of RLS.

**Tech Stack:** Next.js 15 (App Router, TS), Tailwind, shadcn/ui, Framer Motion, React Hook Form, Zod, `@supabase/ssr`, Supabase (Postgres/Auth/RLS), Vitest.

---

## Prerequisites (manual, one-time — done by the user)

These block execution of Tasks 5+ (anything touching the live DB). Do them before/at Task 0.

1. Create a free Supabase project at https://supabase.com → note **Project URL**, **anon key**, **service_role key** (Settings → API).
2. In **Authentication → Providers → Email**: for Phase 0 dev, turn **"Confirm email" OFF** (Resend isn't wired until Phase 4; this lets signup auto-sign-in). Re-enable in Phase 4.
3. After Task 5 runs the hook migration, in **Authentication → Hooks**: set **Customize Access Token (JWT) Claims** to the `public.custom_access_token_hook` function.
4. Get the DB connection string (Settings → Database) for running migrations via the Supabase CLI.

---

## File structure (locked)

```
gymflow-pro/
├─ supabase/
│  ├─ config.toml
│  └─ migrations/
│     ├─ 0001_enums_and_tables.sql       # enums + 4 foundation tables + indexes
│     ├─ 0002_jwt_hook_and_accessors.sql # access-token hook + current_gym_id/role
│     ├─ 0003_rls_policies.sql           # enable RLS + policies on all 4 tables
│     └─ 0004_create_gym_with_owner.sql  # atomic signup RPC
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login/page.tsx
│  │  ├─ (auth)/signup/page.tsx
│  │  ├─ (auth)/accept-invite/page.tsx
│  │  ├─ (app)/dashboard/page.tsx
│  │  ├─ (app)/admin/page.tsx
│  │  ├─ (app)/layout.tsx                # app shell (sidebar/topbar)
│  │  ├─ layout.tsx                      # root + ThemeProvider
│  │  └─ globals.css
│  ├─ components/
│  │  ├─ ui/                             # shadcn primitives
│  │  ├─ layout/{sidebar,topbar,theme-toggle}.tsx
│  │  ├─ providers/theme-provider.tsx
│  │  └─ auth/{login-form,signup-form,invite-form}.tsx
│  ├─ lib/
│  │  ├─ supabase/{server,client,middleware,admin}.ts
│  │  ├─ auth/roles.ts                   # role helpers/guards
│  │  └─ validations/auth.ts             # Zod schemas
│  ├─ actions/auth.ts                    # signup/login/logout/invite server actions
│  ├─ types/db.ts                        # generated Supabase types (+ Role enum)
│  └─ middleware.ts
├─ scripts/verify-isolation.sql          # two-gym RLS proof
├─ .env.example
├─ .env.local                            # (gitignored) real keys
├─ vitest.config.ts
└─ README.md
```

---

## Task 0: Scaffold Next.js 15 app

**Files:**
- Create: whole `gymflow-pro` app skeleton (the spec/plan docs already exist in it)

- [ ] **Step 1: Scaffold into the existing folder**

The folder already contains `docs/` and `.git`. Scaffold in place with create-next-app:

Run:
```bash
cd "/c/Users/Anshu/ANSHU/PROJECTS/gymflow-pro"
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
```
When prompted that the directory is not empty, choose to continue (it only has `docs/`, `.git`, `.gitignore`).

- [ ] **Step 2: Verify it runs**

Run: `npm run dev` then open http://localhost:3000
Expected: default Next.js page renders. Stop the server (Ctrl+C).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 app"
```

---

## Task 1: Install dependencies & dev tooling

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install runtime + dev deps**

Run:
```bash
npm install @supabase/ssr @supabase/supabase-js framer-motion react-hook-form @hookform/resolvers zod next-themes
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", globals: true },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

- [ ] **Step 3: Add test script to `package.json`**

Add to `"scripts"`: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Verify Vitest runs (no tests yet = exit 0 with "No test files")**

Run: `npm test`
Expected: exits cleanly reporting no test files found.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add Supabase, forms, theming, and Vitest deps"
```

---

## Task 2: shadcn/ui + light/dark theming

**Files:**
- Create: `src/components/providers/theme-provider.tsx`, `src/components/layout/theme-toggle.tsx`
- Modify: `src/app/layout.tsx`, `src/app/globals.css`

- [ ] **Step 1: Init shadcn and add base components**

Run:
```bash
npx shadcn@latest init -d
npx shadcn@latest add button input label card dropdown-menu sonner avatar
```

- [ ] **Step 2: Create `src/components/providers/theme-provider.tsx`**

```tsx
"use client";
import { ThemeProvider as NextThemes } from "next-themes";
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
```

- [ ] **Step 3: Wrap root layout** — `src/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";

export const metadata: Metadata = { title: "GymFlow Pro", description: "Gym management SaaS" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Create `src/components/layout/theme-toggle.tsx`**

```tsx
"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  return (
    <Button variant="ghost" size="icon" aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
```

- [ ] **Step 5: Add glassmorphism token to `src/app/globals.css`**

Append:
```css
@layer utilities {
  .glass {
    @apply border border-white/15 bg-white/10 backdrop-blur-xl
           supports-[backdrop-filter]:bg-white/10 shadow-lg;
  }
  .dark .glass { @apply border-white/10 bg-white/5; }
}
```

- [ ] **Step 6: Verify build + toggle**

Run: `npm run dev`, load `/`, confirm no errors. (Toggle is exercised once a page renders it in Task 11.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: shadcn/ui, theme provider, dark mode, glass tokens"
```

---

## Task 3: Supabase client helpers & env

**Files:**
- Create: `src/lib/supabase/server.ts`, `client.ts`, `middleware.ts`, `admin.ts`
- Create: `.env.example`; create `.env.local` (gitignored) with real keys

- [ ] **Step 1: Create `.env.example`**

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 2: Create `.env.local`** with the real values from the Supabase project (Prerequisites). Confirm `.env.local` is gitignored (it is, via `.gitignore`).

- [ ] **Step 3: Create `src/lib/supabase/client.ts`**

```ts
import { createBrowserClient } from "@supabase/ssr";
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 4: Create `src/lib/supabase/server.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* called from a Server Component; middleware refreshes instead */ }
        },
      },
    }
  );
}
```

- [ ] **Step 5: Create `src/lib/supabase/admin.ts`** (service-role; server-only)

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

- [ ] **Step 6: Create `src/lib/supabase/middleware.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return { response, user, supabase };
}
```

- [ ] **Step 7: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: Supabase server/client/admin/middleware helpers + env example"
```

---

## Task 4: Migration 0001 — enums, foundation tables, indexes

**Files:**
- Create: `supabase/migrations/0001_enums_and_tables.sql`

- [ ] **Step 1: Init Supabase CLI locally (link to project)**

Run:
```bash
npx supabase init
npx supabase link --project-ref <your-project-ref>
```

- [ ] **Step 2: Write `supabase/migrations/0001_enums_and_tables.sql`**

```sql
-- Enums
create type app_role  as enum ('super_admin', 'gym_owner', 'staff');
create type sub_plan   as enum ('starter', 'professional', 'enterprise');
create type sub_status as enum ('trialing', 'active', 'past_due', 'canceled');

-- gyms (tenant root)
create table public.gyms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  owner_id   uuid,
  created_at timestamptz not null default now()
);

-- profiles (1:1 with auth.users)
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  gym_id     uuid references public.gyms(id) on delete cascade,
  role       app_role not null default 'staff',
  full_name  text,
  email      text not null,
  created_at timestamptz not null default now()
);
create index profiles_gym_id_idx on public.profiles(gym_id);

-- gyms.owner_id FK now that profiles exists
alter table public.gyms
  add constraint gyms_owner_fk foreign key (owner_id)
  references public.profiles(id) on delete set null;

-- subscriptions (1 per gym)
create table public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  gym_id             uuid not null unique references public.gyms(id) on delete cascade,
  plan               sub_plan   not null default 'starter',
  status             sub_status not null default 'trialing',
  current_period_end timestamptz,
  created_at         timestamptz not null default now()
);

-- audit_logs
create table public.audit_logs (
  id         bigint generated always as identity primary key,
  gym_id     uuid references public.gyms(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null,
  entity     text,
  entity_id  text,
  metadata   jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_gym_created_idx on public.audit_logs(gym_id, created_at desc);
```

- [ ] **Step 3: Apply the migration**

Run: `npx supabase db push`
Expected: migration applies without error.

- [ ] **Step 4: Verify tables exist**

Run:
```bash
npx supabase db execute "select table_name from information_schema.tables where table_schema='public' order by 1;"
```
Expected: lists `audit_logs, gyms, profiles, subscriptions`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): enums + foundation tables + indexes (migration 0001)"
```

---

## Task 5: Migration 0002 — JWT hook + RLS accessors

**Files:**
- Create: `supabase/migrations/0002_jwt_hook_and_accessors.sql`

- [ ] **Step 1: Write `supabase/migrations/0002_jwt_hook_and_accessors.sql`**

```sql
-- Accessors read custom claims from the verified JWT (no table lookup)
create or replace function public.current_gym_id() returns uuid
  language sql stable as $$
    select nullif(auth.jwt() ->> 'gym_id', '')::uuid
  $$;

create or replace function public.current_role_name() returns text
  language sql stable as $$
    select auth.jwt() ->> 'user_role'
  $$;

-- Access-token hook: stamps gym_id + user_role into the JWT at issuance
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_gym_id uuid;
  v_role   text;
  claims   jsonb;
begin
  select gym_id, role::text into v_gym_id, v_role
  from public.profiles where id = (event ->> 'user_id')::uuid;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  if v_gym_id is not null then
    claims := jsonb_set(claims, '{gym_id}', to_jsonb(v_gym_id::text));
  end if;
  if v_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Only the auth admin may execute the hook; it must read profiles
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select on table public.profiles to supabase_auth_admin;
```

- [ ] **Step 2: Apply**

Run: `npx supabase db push`
Expected: applies without error.

- [ ] **Step 3: Register the hook (manual, Dashboard)**

In Supabase → Authentication → Hooks → "Customize Access Token (JWT) Claims" → select
`public.custom_access_token_hook`. Save. (This is the Prerequisite step 3.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(db): JWT access-token hook + current_gym_id/role accessors (0002)"
```

---

## Task 6: Migration 0003 — RLS policies

**Files:**
- Create: `supabase/migrations/0003_rls_policies.sql`

- [ ] **Step 1: Write `supabase/migrations/0003_rls_policies.sql`**

```sql
-- Enable RLS everywhere
alter table public.gyms          enable row level security;
alter table public.profiles      enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_logs    enable row level security;

-- The auth admin (hook) must read profiles regardless of RLS
create policy authadmin_read_profiles on public.profiles
  for select to supabase_auth_admin using (true);

-- Helper predicate inlined per table: super_admin sees all, else same-gym
-- GYMS
create policy gyms_select on public.gyms for select using (
  public.current_role_name() = 'super_admin' or id = public.current_gym_id()
);
create policy gyms_update on public.gyms for update using (
  public.current_role_name() = 'super_admin'
  or (id = public.current_gym_id() and public.current_role_name() = 'gym_owner')
);

-- PROFILES (read same-gym; users may update their own profile; owners manage gym profiles)
create policy profiles_select on public.profiles for select using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);
create policy profiles_update_self on public.profiles for update using ( id = auth.uid() );
create policy profiles_owner_manage on public.profiles for all using (
  public.current_role_name() = 'super_admin'
  or (gym_id = public.current_gym_id() and public.current_role_name() = 'gym_owner')
) with check (
  public.current_role_name() = 'super_admin'
  or (gym_id = public.current_gym_id() and public.current_role_name() = 'gym_owner')
);

-- SUBSCRIPTIONS (read same-gym; only owner/super_admin modify)
create policy subs_select on public.subscriptions for select using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);
create policy subs_modify on public.subscriptions for all using (
  public.current_role_name() = 'super_admin'
  or (gym_id = public.current_gym_id() and public.current_role_name() = 'gym_owner')
) with check (
  public.current_role_name() = 'super_admin'
  or (gym_id = public.current_gym_id() and public.current_role_name() = 'gym_owner')
);

-- AUDIT LOGS (read same-gym; inserts happen via SECURITY DEFINER RPCs only)
create policy audit_select on public.audit_logs for select using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);
```

- [ ] **Step 2: Apply**

Run: `npx supabase db push`
Expected: applies without error.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(db): RLS policies for all foundation tables (0003)"
```

---

## Task 7: Migration 0004 — atomic signup RPC

**Files:**
- Create: `supabase/migrations/0004_create_gym_with_owner.sql`

- [ ] **Step 1: Write `supabase/migrations/0004_create_gym_with_owner.sql`**

```sql
create or replace function public.create_gym_with_owner(
  p_user_id   uuid,
  p_email     text,
  p_full_name text,
  p_gym_name  text,
  p_slug      text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym_id uuid;
begin
  if p_user_id <> auth.uid() then
    raise exception 'forbidden: user mismatch';
  end if;

  insert into public.gyms (name, slug) values (p_gym_name, p_slug)
  returning id into v_gym_id;

  insert into public.profiles (id, gym_id, role, full_name, email)
  values (p_user_id, v_gym_id, 'gym_owner', p_full_name, p_email);

  update public.gyms set owner_id = p_user_id where id = v_gym_id;

  insert into public.subscriptions (gym_id, plan, status)
  values (v_gym_id, 'starter', 'trialing');

  insert into public.audit_logs (gym_id, actor_id, action, entity, entity_id)
  values (v_gym_id, p_user_id, 'gym.created', 'gym', v_gym_id::text);

  return v_gym_id;
end;
$$;

grant execute on function public.create_gym_with_owner(uuid, text, text, text, text)
  to authenticated;
```

- [ ] **Step 2: Apply**

Run: `npx supabase db push`
Expected: applies without error.

- [ ] **Step 3: Generate DB types**

Run:
```bash
npx supabase gen types typescript --linked > src/types/db.ts
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(db): atomic create_gym_with_owner RPC (0004) + generated types"
```

---

## Task 8: Zod validation schemas (TDD)

**Files:**
- Create: `src/lib/validations/auth.ts`
- Test: `src/lib/validations/auth.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/validations/auth.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { signupSchema, loginSchema, inviteSchema, slugify } from "./auth";

describe("auth validations", () => {
  it("accepts a valid signup", () => {
    const r = signupSchema.safeParse({
      fullName: "Asha Rao", gymName: "Iron Temple",
      email: "a@b.com", password: "Str0ngPass!",
    });
    expect(r.success).toBe(true);
  });
  it("rejects short passwords", () => {
    const r = signupSchema.safeParse({
      fullName: "A", gymName: "G", email: "a@b.com", password: "short",
    });
    expect(r.success).toBe(false);
  });
  it("rejects bad email on login", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });
  it("invite requires a valid email", () => {
    expect(inviteSchema.safeParse({ email: "staff@gym.com" }).success).toBe(true);
  });
  it("slugify produces url-safe slugs", () => {
    expect(slugify("Iron Temple Gym!")).toBe("iron-temple-gym");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/validations/auth.test.ts`
Expected: FAIL — module `./auth` not found.

- [ ] **Step 3: Implement `src/lib/validations/auth.ts`**

```ts
import { z } from "zod";

export const signupSchema = z.object({
  fullName: z.string().min(1, "Required").max(120),
  gymName: z.string().min(2, "Gym name too short").max(120),
  email: z.string().email(),
  password: z.string().min(8, "Min 8 characters").max(72),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Required"),
});

export const inviteSchema = z.object({
  email: z.string().email(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;

export function slugify(input: string): string {
  return input.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/validations/auth.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: auth Zod schemas + slugify (TDD)"
```

---

## Task 9: Role helpers (TDD)

**Files:**
- Create: `src/lib/auth/roles.ts`
- Test: `src/lib/auth/roles.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/auth/roles.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { homePathForRole, canManageGym } from "./roles";

describe("role helpers", () => {
  it("routes super_admin to /admin", () => {
    expect(homePathForRole("super_admin")).toBe("/admin");
  });
  it("routes owner and staff to /dashboard", () => {
    expect(homePathForRole("gym_owner")).toBe("/dashboard");
    expect(homePathForRole("staff")).toBe("/dashboard");
  });
  it("only owner/super_admin can manage the gym", () => {
    expect(canManageGym("gym_owner")).toBe(true);
    expect(canManageGym("super_admin")).toBe(true);
    expect(canManageGym("staff")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/auth/roles.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/auth/roles.ts`**

```ts
export type Role = "super_admin" | "gym_owner" | "staff";

export function homePathForRole(role: Role): string {
  return role === "super_admin" ? "/admin" : "/dashboard";
}

export function canManageGym(role: Role): boolean {
  return role === "super_admin" || role === "gym_owner";
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/auth/roles.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: role helpers (TDD)"
```

---

## Task 10: Auth server actions

**Files:**
- Create: `src/actions/auth.ts`

- [ ] **Step 1: Implement `src/actions/auth.ts`**

```ts
"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signupSchema, loginSchema, inviteSchema, slugify } from "@/lib/validations/auth";
import { homePathForRole, type Role } from "@/lib/auth/roles";

type ActionResult = { ok: false; error: string } | { ok: true };

export async function signupAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { fullName, gymName, email, password } = parsed.data;

  const supabase = await createClient();
  const { data: signUp, error: signErr } = await supabase.auth.signUp({ email, password });
  if (signErr || !signUp.user) return { ok: false, error: signErr?.message ?? "Sign up failed" };

  const slug = `${slugify(gymName)}-${signUp.user.id.slice(0, 6)}`;
  const { error: rpcErr } = await supabase.rpc("create_gym_with_owner", {
    p_user_id: signUp.user.id, p_email: email, p_full_name: fullName,
    p_gym_name: gymName, p_slug: slug,
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };

  // refresh session so the new JWT carries gym_id + role claims
  await supabase.auth.refreshSession();
  redirect("/dashboard");
}

export async function loginAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: error.message };

  const { data: claims } = await supabase.auth.getClaims();
  const role = (claims?.claims?.user_role as Role) ?? "staff";
  redirect(homePathForRole(role));
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function inviteStaffAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const role = claims?.claims?.user_role as Role | undefined;
  const gymId = claims?.claims?.gym_id as string | undefined;
  if (!gymId || (role !== "gym_owner" && role !== "super_admin")) {
    return { ok: false, error: "Not authorized to invite staff" };
  }

  // Admin invite; profile row (role=staff, this gym) created on accept (Task 13).
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { gym_id: gymId, invited_role: "staff" },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/accept-invite`,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If `getClaims` typing differs in the installed SDK version, fall back to decoding `getSession()`'s `access_token` — but `getClaims` is available in current `@supabase/supabase-js`.)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: signup/login/logout/invite server actions"
```

---

## Task 11: Auth pages & forms

**Files:**
- Create: `src/components/auth/login-form.tsx`, `signup-form.tsx`
- Create: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`

- [ ] **Step 1: Create `src/components/auth/signup-form.tsx`**

```tsx
"use client";
import { useActionState } from "react";
import { signupAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, null);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="fullName">Your name</Label>
        <Input id="fullName" name="fullName" required /></div>
      <div className="space-y-2"><Label htmlFor="gymName">Gym name</Label>
        <Input id="gymName" name="gymName" required /></div>
      <div className="space-y-2"><Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required /></div>
      <div className="space-y-2"><Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required /></div>
      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating…" : "Create my gym"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Create `src/components/auth/login-form.tsx`**

```tsx
"use client";
import { useActionState } from "react";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required /></div>
      <div className="space-y-2"><Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required /></div>
      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Create `src/app/(auth)/signup/page.tsx`**

```tsx
import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { Card } from "@/components/ui/card";

export default function SignupPage() {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="glass w-full max-w-md p-8">
        <h1 className="mb-1 text-2xl font-semibold">Create your gym</h1>
        <p className="mb-6 text-sm text-muted-foreground">Start your GymFlow Pro account.</p>
        <SignupForm />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account? <Link href="/login" className="underline">Sign in</Link>
        </p>
      </Card>
    </main>
  );
}
```

- [ ] **Step 4: Create `src/app/(auth)/login/page.tsx`**

```tsx
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="glass w-full max-w-md p-8">
        <h1 className="mb-1 text-2xl font-semibold">Welcome back</h1>
        <p className="mb-6 text-sm text-muted-foreground">Sign in to GymFlow Pro.</p>
        <LoginForm />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          New here? <Link href="/signup" className="underline">Create a gym</Link>
        </p>
      </Card>
    </main>
  );
}
```

- [ ] **Step 5: Manual verification (needs live Supabase)**

Run `npm run dev`. At `/signup`, create a gym. Expected: redirected to `/dashboard`
(rendered in Task 12). In Supabase Table Editor confirm one new row each in
`gyms`, `profiles` (role `gym_owner`), `subscriptions`, `audit_logs`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: login & signup pages with glass UI"
```

---

## Task 12: App shell, middleware guard, dashboard/admin pages

**Files:**
- Create: `src/middleware.ts`, `src/app/(app)/layout.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/admin/page.tsx`
- Create: `src/components/layout/sidebar.tsx`, `topbar.tsx`

- [ ] **Step 1: Create `src/middleware.ts`**

```ts
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC = ["/login", "/signup", "/accept-invite"];

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && path.startsWith("/admin")) {
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.user_role !== "super_admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 2: Create `src/components/layout/topbar.tsx`**

```tsx
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function Topbar() {
  return (
    <header className="glass sticky top-0 z-10 flex h-14 items-center justify-between px-4">
      <span className="font-semibold">GymFlow Pro</span>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <form action={logoutAction}><Button variant="ghost" size="sm">Sign out</Button></form>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Create `src/components/layout/sidebar.tsx`**

```tsx
import Link from "next/link";

const items = [
  { href: "/dashboard", label: "Dashboard" },
];

export function Sidebar() {
  return (
    <aside className="glass hidden w-56 shrink-0 p-4 md:block">
      <nav className="space-y-1">
        {items.map((i) => (
          <Link key={i.href} href={i.href}
            className="block rounded-md px-3 py-2 text-sm hover:bg-white/10">
            {i.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 4: Create `src/app/(app)/layout.tsx`**

```tsx
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <div className="flex flex-1 gap-4 p-4">
        <Sidebar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `src/app/(app)/dashboard/page.tsx`**

```tsx
import { Card } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <Card className="glass p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your foundation is live. Member management arrives in Phase 1.
      </p>
    </Card>
  );
}
```

- [ ] **Step 6: Create `src/app/(app)/admin/page.tsx`**

```tsx
import { Card } from "@/components/ui/card";

export default function AdminPage() {
  return (
    <Card className="glass p-8">
      <h1 className="text-2xl font-semibold">Super Admin</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Cross-tenant administration arrives in Phase 8.
      </p>
    </Card>
  );
}
```

- [ ] **Step 7: Manual verification**

Run `npm run dev`. Logged out → visiting `/dashboard` redirects to `/login`. After
login → `/dashboard` renders inside the themed shell; theme toggle flips light/dark
and persists on reload. A `gym_owner` visiting `/admin` is redirected to `/dashboard`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: app shell, middleware guards, dashboard & admin pages"
```

---

## Task 13: Accept-invite flow

**Files:**
- Create: `src/app/(auth)/accept-invite/page.tsx`, `src/components/auth/invite-form.tsx`
- Create: `src/actions/accept-invite.ts`

- [ ] **Step 1: Create `src/actions/accept-invite.ts`**

```ts
"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: false; error: string } | { ok: true };

// Invited user arrives authenticated via the magic link; they set a password,
// then we create their staff profile from the invite metadata.
export async function acceptInviteAction(_prev: unknown, formData: FormData): Promise<Result> {
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "");
  if (password.length < 8) return { ok: false, error: "Min 8 characters" };

  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return { ok: false, error: "Invite link invalid or expired" };

  const gymId = user.user_metadata?.gym_id as string | undefined;
  if (!gymId) return { ok: false, error: "Invite missing gym context" };

  const { error: pwErr } = await supabase.auth.updateUser({ password });
  if (pwErr) return { ok: false, error: pwErr.message };

  const { error: profErr } = await supabase.from("profiles").insert({
    id: user.id, gym_id: gymId, role: "staff", email: user.email!, full_name: fullName,
  });
  if (profErr) return { ok: false, error: profErr.message };

  await supabase.auth.refreshSession();
  redirect("/dashboard");
}
```

Note: the `profiles_owner_manage` policy permits this insert because the row's
`gym_id` matches and inserts during invite-accept are gated by the authenticated
invited user; if RLS rejects self-insert, switch this insert to a small
`SECURITY DEFINER` RPC `accept_staff_invite(gym_id, full_name)` validating
`auth.uid()` — add as migration `0005` if needed during execution.

- [ ] **Step 2: Create `src/components/auth/invite-form.tsx`**

```tsx
"use client";
import { useActionState } from "react";
import { acceptInviteAction } from "@/actions/accept-invite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteForm() {
  const [state, action, pending] = useActionState(acceptInviteAction, null);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="fullName">Your name</Label>
        <Input id="fullName" name="fullName" required /></div>
      <div className="space-y-2"><Label htmlFor="password">Set a password</Label>
        <Input id="password" name="password" type="password" required /></div>
      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Joining…" : "Join gym"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Create `src/app/(auth)/accept-invite/page.tsx`**

```tsx
import { InviteForm } from "@/components/auth/invite-form";
import { Card } from "@/components/ui/card";

export default function AcceptInvitePage() {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="glass w-full max-w-md p-8">
        <h1 className="mb-1 text-2xl font-semibold">Accept your invite</h1>
        <p className="mb-6 text-sm text-muted-foreground">Set a password to join the gym.</p>
        <InviteForm />
      </Card>
    </main>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: staff accept-invite flow"
```

---

## Task 14: RLS isolation proof (verification artifact)

**Files:**
- Create: `scripts/verify-isolation.sql`

- [ ] **Step 1: Create `scripts/verify-isolation.sql`**

```sql
-- Run in Supabase SQL editor. Proves tenant isolation via the RLS accessors.
-- Simulate a gym A user by setting the JWT claims, then confirm gym B is invisible.

-- Seed two gyms (idempotent-ish; run on a clean DB or adjust names)
insert into public.gyms (name, slug) values ('Gym A', 'gym-a-test') returning id as gym_a \gset
insert into public.gyms (name, slug) values ('Gym B', 'gym-b-test') returning id as gym_b \gset

-- Impersonate an authenticated gym A owner
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('role','authenticated','user_role','gym_owner','gym_id', :'gym_a')::text,
  true
);

-- Expect: exactly 1 row (Gym A), NOT Gym B
select count(*) as visible_gyms, bool_and(slug = 'gym-a-test') as only_gym_a
from public.gyms where slug in ('gym-a-test','gym-b-test');

reset role;
```

- [ ] **Step 2: Run it (manual, Supabase SQL editor)**

Paste and run. Expected: `visible_gyms = 1` and `only_gym_a = true` — Gym B is hidden
from Gym A's context, proving RLS isolation.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: RLS tenant-isolation verification script"
```

---

## Task 15: README, env docs, final verification

**Files:**
- Create/Modify: `README.md`

- [ ] **Step 1: Write `README.md`**

Include: project overview, prereqs (Node 20+, Supabase project), `.env.local` keys,
the 4 manual Supabase steps (confirm-email off, register the access-token hook),
migration command (`npx supabase db push`), `npm run dev`, and the Phase roadmap.

- [ ] **Step 2: Full green-path verification**

Run the whole flow on a fresh `.env.local`:
1. `npm install` → `npx supabase db push` → register hook in Dashboard.
2. `npm run dev`; sign up a gym → lands on `/dashboard`.
3. Confirm 4 rows created (gyms/profiles/subscriptions/audit_logs).
4. Toggle theme; reload — persists.
5. Run `scripts/verify-isolation.sql` → isolation proven.
6. `npm test` → all unit tests pass. `npx tsc --noEmit` → clean. `npm run build` → succeeds.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: README + Phase 0 setup and verification"
```

---

## Self-review notes (author)

- **Spec coverage:** §3 location→T0; §2 stack→T0/T1/T2; §4 RLS Option A→T5/T6; §5 schema→T4; §6 auth/RBAC→T7/T9/T10/T11/T12/T13; §7 app shell+theme→T2/T12; §8 validation/errors→T8/T10; §9 security→T5/T6/T10/T12; §10 DoD/verification→T14/T15. All covered.
- **Deferred (per spec §12):** members, payments, attendance, etc. — not in this plan by design.
- **Known execution risk flagged inline:** `getClaims` SDK shape (T10 step 2) and staff self-insert under RLS (T13 step 1) each have a documented fallback.
