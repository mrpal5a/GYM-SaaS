# GymFlow Pro

Multi-tenant gym-management SaaS. Each gym's data is strictly isolated via
PostgreSQL Row Level Security driven by JWT custom claims.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui ·
Framer Motion · React Hook Form + Zod · Supabase (Postgres/Auth/RLS) · Vitest.

> **Status:** Phase 0 foundation **+ Phases 1‑3 and the Phase 6 dashboard** —
> member management (CRUD, search/filter, photo, BMI), membership plans with an
> expiry/status engine, payments/invoices, and a stats + charts dashboard. See
> `docs/superpowers/` for the spec, plan, and roadmap.

---

## Prerequisites

- Node.js 20+ (developed on 24) and npm
- A free [Supabase](https://supabase.com) project

## 1. Install

```bash
npm install
```

## 2. Environment

Copy `.env.example` to `.env.local` and fill in your Supabase keys
(Supabase Dashboard → Settings → API):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>   # secret — server-only
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional — emailing invoice PDFs (Resend). Without a key, the invoice Email
# button returns a friendly "not configured" message; WhatsApp + Print still work.
RESEND_API_KEY=<resend api key>
RESEND_FROM_EMAIL=invoices@yourgym.com        # must be on a Resend-verified domain
```

`.env.local` is gitignored. Never commit real keys.

## 3. Database

Apply the SQL migrations in `supabase/migrations/` (in numeric order) to your
project. Either paste them into the Supabase **SQL Editor**, or use the Supabase
CLI:

```bash
npx supabase link --project-ref <your-ref>
npx supabase db push
```

Migrations:

| File | Purpose |
|------|---------|
| `0001_enums_and_tables.sql` | enums + `gyms`, `profiles`, `subscriptions`, `audit_logs` + indexes |
| `0002_jwt_hook_and_accessors.sql` | access-token hook + `current_gym_id()` / `current_role_name()` |
| `0003_rls_policies.sql` | RLS enabled + tenant-isolation policies |
| `0004_create_gym_with_owner.sql` | atomic signup RPC |
| `0005_profile_update_guard.sql` | trigger blocking profile privilege escalation |
| `0006_accept_staff_invite.sql` | staff-onboarding RPC |
| `0007_member_tables.sql` | `members`, `membership_plans`, `member_subscriptions`, `payments` + enums/indexes |
| `0008_member_rls.sql` | RLS tenant-isolation policies for the Phase 1‑3 tables |
| `0009_member_views_rpc.sql` | `member_with_status` view + `assign_membership()` RPC |
| `0010_member_photos_storage.sql` | `member-photos` storage bucket + folder-scoped RLS |
| `0011_accept_staff_invite_app_metadata.sql` | security fix: derive invite gym from admin-only `app_metadata` |
| `0012_gym_branding_logos.sql` | `gyms.logo_url` column + `gym-logos` storage bucket (owner-scoped RLS) |
| `0013_invoice_pdfs_storage.sql` | `invoices` storage bucket (public read, gym-folder-scoped writes) for shared invoice PDFs |
| `0014_join_requests.sql` | `gyms.join_token`/`upi_id`/`upi_payee_name`; `join_requests` table + RLS (gym-wide read, owner-only update) for self-service onboarding |
| `0015_join_uploads_storage.sql` | `join-uploads` storage bucket (public read) for prospect photo + UPI payment screenshot |
| `0016_approve_join_request.sql` | `approve_join_request()` RPC — atomically turns an approved request into a member + subscription + payment |

> After adding `0007`–`0010`, **new gyms work immediately**. The `member-photos`
> bucket is created by `0010` (public read, writes scoped to each gym's folder).
> If your Supabase project blocks `insert into storage.buckets` from the SQL
> editor, create a public bucket named `member-photos` manually (Storage → New
> bucket) and then run the three policy statements from `0010`.

## 4. Two required Supabase dashboard settings

1. **Authentication → Hooks → "Customize Access Token (JWT) Claims"** → enable →
   select `public.custom_access_token_hook` → Save.
   *(Without this, JWTs won't carry `gym_id`/`user_role` and RLS will deny everything.)*
2. **Authentication → Sign In / Providers → Email → "Confirm email" → OFF**
   (development only; re-enable once transactional email lands in Phase 4).

## 5. Run

```bash
npm run dev      # http://localhost:3000
```

Sign up at `/signup` → a gym + owner + trial subscription are created atomically,
and you land on `/dashboard`. Toggle light/dark from the top bar.

Then: create a plan on **/plans**, add members on **/members**, assign a plan and
record payments from a member's profile, and watch the **/dashboard** stats,
revenue chart, and "expiring soon" list populate.

---

## Scripts

```bash
npm run dev      # dev server
npm run build    # production build
npm test         # unit tests (Vitest)
npx tsc --noEmit # typecheck

# Prove tenant isolation + the privilege-escalation guard against the live DB:
U=$NEXT_PUBLIC_SUPABASE_URL ANON=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
  SR=$SUPABASE_SERVICE_ROLE_KEY node scripts/verify-isolation.mjs
```

`scripts/verify-isolation.mjs` spins up two gyms + a staff user, asserts neither
gym can see the other's data, asserts staff/owner cannot escalate to
`super_admin`, then cleans up. Expected: `11/11 checks passed`.

---

## Architecture notes

- **Multi-tenancy:** every tenant table carries `gym_id`; RLS policies compare it
  to `current_gym_id()`, which reads the `gym_id` custom claim from the verified
  JWT (stamped by `custom_access_token_hook`). No per-request table lookups.
- **RBAC:** roles `super_admin | gym_owner | staff` enforced at both the RLS layer
  and inside server actions. `super_admin` has explicit cross-tenant carve-outs.
- **Security:** profile updates are guarded by a `BEFORE UPDATE` trigger so a user
  cannot change their own `role`/`gym_id` (RLS alone can't prevent this — see the
  comment in `0005_profile_update_guard.sql`).
- **Mutations:** all writes go through Next.js server actions that re-validate with
  Zod server-side; the client is never the security boundary.

## Phase roadmap

0 (done) Foundation · 1 (done) Members · 2 (done) Plans + expiry · 3 (done)
Payments · 4 Email (Resend) — *invoice PDF over email + WhatsApp share done* · 5
Attendance · 6 (done) Dashboard charts · 7 Body
progress / notifications / reports · 8 Super-admin + billing. Each phase has its
own spec + plan under `docs/superpowers/`.

---

## Known follow-ups

- Next 16 renamed the `middleware.ts` convention to `proxy.ts` (deprecation
  warning only; current file works). Migrate when convenient.
- `globals.css`: the Geist **sans** font variable mapping is self-referential
  (`--font-sans: var(--font-sans)`); sans currently falls back to system. Minor.
- **Member photos** use a *public* storage bucket with unguessable UUID filenames
  (writes are still gym-folder-scoped by RLS). Fine for an MVP; switch to a private
  bucket + signed URLs if photos are sensitive.
- **Currency** is hard-coded to INR (`formatMoney` in `src/lib/members/metrics.ts`);
  make it per-gym when billing settings land.
- Membership status (`active`/`expiring`/`expired`) is **derived on read** from
  `end_date` via the `member_with_status` view — no cron needed. A scheduled job to
  email expiry reminders arrives in Phase 4.
- **Public join form** (`/join/<token>`, self-service onboarding): the v1 defense is
  the unguessable `join_token` + server-side validation via the service-role client.
  Rate-limiting, a duplicate-phone guard, and owner email-on-submit are intended
  follow-ups before high-volume public exposure.
