# GymFlow Pro — Production Deployment Runbook

Step-by-step guide to take GymFlow Pro from this repo to a live deployment on
**Vercel + Supabase**, then hand a gym owner their login. Follow the parts in
order; each part ends with a ✅ checkpoint.

> **Mental model.** Supabase holds the database + auth + file storage. Vercel runs
> the Next.js app. Gyms are **not** self-service — a **super-admin** (you) creates
> each gym owner's account from the in-app admin console. Every gym's data is
> isolated by Postgres Row-Level Security keyed on JWT claims.

---

## 0. Prerequisites (one-time)

- A [Supabase](https://supabase.com) account (free tier is fine to start).
- A [Vercel](https://vercel.com) account, connected to the GitHub repo.
- The repo pushed to GitHub (Vercel deploys from it).
- (Optional, for emailed invoices) a [Resend](https://resend.com) account.
- Locally: Node `24.12.0` (see `.nvmrc`) and the Supabase CLI (`npx supabase`).

---

## Part A — Create the Supabase production project

1. **Supabase Dashboard → New project.** Pick a strong DB password and a region
   close to the gym (e.g. Mumbai `ap-south-1` for India). Wait for provisioning.
2. **Settings → API** — copy these three values (used in Part C):
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **server-only, never expose**

✅ *Checkpoint: project created, three keys saved somewhere safe.*

---

## Part B — Apply the database migrations

All schema, RLS, RPCs and storage buckets live in `supabase/migrations/`
(`0001`–`0023`). Apply them **in numeric order**.

**Option 1 — Supabase CLI (recommended):**
```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

**Option 2 — SQL Editor:** open each file `0001…0023` in order, paste into
**SQL Editor**, and Run.

**Storage buckets fallback.** Migrations `0010`, `0012`, `0013`, `0015` create the
buckets `member-photos`, `gym-logos`, `invoices`, `join-uploads`. If your project
blocks `insert into storage.buckets` from SQL, create each manually
(**Storage → New bucket**, public read) then re-run that migration's policy
statements.

✅ *Checkpoint: tables exist under **Table Editor**; the four storage buckets exist.*

---

## Part C — Configure Supabase Auth (production settings)

Under **Authentication**:

1. **→ Hooks → "Customize Access Token (JWT) Claims"** → **Enable** → select
   `public.custom_access_token_hook` → Save.
   **This is mandatory** — without it JWTs carry no `gym_id`/`user_role` and RLS
   denies everything (you'd see empty pages everywhere).
2. **→ Sign In / Providers → Email:**
   - **"Allow new users to sign up" → OFF.** Public signup is intentionally closed
     (migration `0023`); accounts are created by the super-admin.
   - **"Confirm email" → ON** for production. (Admin-created owners are
     auto-confirmed in code; staff confirm via their invite link.)
3. **→ URL Configuration:**
   - **Site URL:** your production URL (set the real one in Part E; for now the
     Vercel URL is fine).
   - **Redirect URLs:** add `https://<your-domain>/accept-invite` and
     `https://<your-domain>/**`. Staff-invite and accept-invite links break
     without this.

✅ *Checkpoint: JWT hook enabled, public signup off, redirect URLs added.*

---

## Part D — Deploy the app to Vercel

1. **Vercel → Add New → Project →** import the GitHub repo.
2. **Framework Preset:** Next.js (auto-detected).
   **Root Directory:** the folder containing `package.json` (the app root — leave
   default if the repo root *is* the app; otherwise point it at `gymflow-pro/`).
3. **Settings → General → Node.js Version:** select **24.x** (the repo pins
   `24.12.0`; `package.json` requires `>=24`). If 24 isn't offered yet, pick the
   highest available and confirm the build still passes.
4. **Environment Variables** (Settings → Environment Variables) — add for
   **Production** (and Preview if you want previews to work):

   | Name | Value | Notes |
   |------|-------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | from Part A | |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Part A | |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Part A | **secret** |
   | `NEXT_PUBLIC_SITE_URL` | leave unset for the first deploy | set in Part E |
   | `RESEND_API_KEY` | optional | Part F |
   | `RESEND_FROM_EMAIL` | optional | Part F |

   > You can skip `NEXT_PUBLIC_SITE_URL` on the very first deploy — the app falls
   > back to Vercel's auto-injected production URL so join/invite links still work.
5. **Deploy.** Wait for the build to go green.

✅ *Checkpoint: the Vercel URL loads and redirects to `/login`.*

---

## Part E — Wire the real domain back into both sides

1. (If using a custom domain) **Vercel → Settings → Domains →** add it and follow
   the DNS steps.
2. **Vercel → Env vars:** set `NEXT_PUBLIC_SITE_URL` to the canonical URL
   (e.g. `https://app.yourgym.com`, no trailing slash) → **Redeploy**.
3. **Supabase → Authentication → URL Configuration:** update **Site URL** and
   **Redirect URLs** to that same domain.

✅ *Checkpoint: `NEXT_PUBLIC_SITE_URL`, Vercel domain, and Supabase URLs all match.*

---

## Part F — Email invoices via Resend (optional but recommended)

Without this, the **Email** button on invoices returns a friendly "not
configured" message; **WhatsApp share + Print still work**.

1. Resend → add and **verify your sending domain** (DNS records).
2. Set Vercel env vars and redeploy:
   - `RESEND_API_KEY` = your Resend API key
   - `RESEND_FROM_EMAIL` = an address on the verified domain (e.g. `invoices@yourgym.com`)

> Until a domain is verified, Resend only delivers to your own account email.

✅ *Checkpoint: sending a test invoice email arrives.*

---

## Part G — Bootstrap the first super-admin (one-time, manual)

Because public signup is closed, create your own admin account directly:

1. **Supabase → Authentication → Users → Add user.** Enter your email + a
   password, tick **Auto Confirm User**. Copy the new user's **UID**.
2. **Supabase → SQL Editor**, run (substitute the UID + email):
   ```sql
   insert into public.profiles (id, email, full_name, role, gym_id)
   values ('<USER-UID>', 'you@example.com', 'Platform Admin', 'super_admin', null);
   ```
   (`gym_id` is null for a platform admin — that's expected.)
3. Log in at `https://<your-domain>/login`. You should reach **`/admin`**.

✅ *Checkpoint: you can open `/admin` as super-admin.*

---

## Part H — Create the gym owner's account

As super-admin, in the app:

1. **/admin → Create gym** (`/admin/gyms/new`). Fill in gym name, the **owner's**
   name + email, a temporary password, plan, and period end. Submit — this
   atomically creates the gym, the owner account (already email-confirmed), and a
   subscription.
2. Give the owner their **login URL + email + temporary password**, and tell them
   to change it under **Settings → Change password** on first login.

✅ *Checkpoint: the owner can log in and lands on their `/dashboard`.*

---

## Part I — Pre-handover smoke test (do this on the live URL)

Run through the full happy path once as the gym owner:

- [ ] Log in → dashboard loads with stats.
- [ ] **Plans:** create one membership plan + one Personal Trainer plan.
- [ ] **Members:** add a member with a photo; assign the plan; record a payment.
- [ ] **Payments:** the record appears; open its **Invoice**; **Print** works;
      **WhatsApp** link opens; **Email** sends (if Resend configured).
- [ ] **Search** works on members, payments, renewals, join-requests.
- [ ] **Join flow:** open the gym's QR/join link in an incognito window, submit a
      request; back in the app, **/join-requests** shows it → **Approve** creates
      the member.
- [ ] **Delete** a test member/plan → it asks for your password, rejects a wrong
      one, deletes on the right one.
- [ ] **Renewals:** an expiring member shows up; the WhatsApp reminder link works.
- [ ] Visit a nonsense URL → styled **404**. (Error pages are wired too.)

✅ *Checkpoint: every box ticked.*

---

## Part J — Go-live cleanup

- If you loaded demo data while testing, remove it:
  ```bash
  node --env-file=.env.local scripts/seed-demo.mjs --clean
  ```
  (Point `.env.local` at the **production** project only for this, then revert.)
- (Optional) Prove tenant isolation against prod (it self-cleans):
  ```bash
  U=$NEXT_PUBLIC_SUPABASE_URL ANON=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    SR=$SUPABASE_SERVICE_ROLE_KEY node scripts/verify-isolation.mjs
  # expect: 11/11 checks passed
  ```
- Delete any throwaway test gyms/members you created.
- Confirm **"Allow new users to sign up"** is still **OFF**.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|--------|--------------------|
| Every page is empty / "not authorized", or RLS denies all | JWT claims hook not enabled (**Part C.1**). Enable it, then log out/in. |
| Login works but `/admin` bounces to `/dashboard` | The logged-in user isn't `super_admin` — re-check the `profiles` row (Part G). |
| Join links / invite emails point at `localhost` | `NEXT_PUBLIC_SITE_URL` unset/wrong, or Supabase redirect URLs not updated (**Parts E**). |
| Staff invite link errors | Add `/accept-invite` (and `/**`) to Supabase **Redirect URLs**. |
| Member photo upload silently has no image | `member-photos` bucket missing or its RLS policies not applied (**Part B** fallback). |
| Invoice **Email** says "not configured" | `RESEND_API_KEY`/`RESEND_FROM_EMAIL` unset, or domain unverified (**Part F**). |
| Vercel build fails on Node engine | Set Node 24.x in project settings (**Part D.3**). |

## Rollback

- **App:** Vercel → Deployments → pick the last good build → **Promote to
  Production** (instant).
- **Database:** migrations are additive; avoid editing applied ones. For a new
  change, add `00NN_*.sql` and `db push` again. Take a Supabase backup before any
  manual SQL on production.

---

*Keep `SUPABASE_SERVICE_ROLE_KEY` and Resend keys only in Vercel env vars and your
local `.env.local` (gitignored) — never in the repo.*
