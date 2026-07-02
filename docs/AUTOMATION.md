# GymFlow Pro — Automated Email & Cron Jobs

Everything the app sends automatically (invoices, welcomes, renewal reminders,
weekly backups) and the scheduled jobs behind them. Pair this with
[DEPLOYMENT.md](./DEPLOYMENT.md) — it assumes the app is already deployed on
Vercel + Supabase.

---

## Prerequisites

| Requirement | Why |
|-------------|-----|
| **Resend account + verified domain** | All automated mail goes out via Resend. Until a domain is verified, Resend **only delivers to your own Resend account email** — real members/owners won't receive anything. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | The sending key and the "from" address (must be on the verified domain). |
| `CRON_SECRET` | Guards the cron endpoints (below). A long random string. |
| Migrations `0025`, `0026`, `0032` applied | `renewal_reminders`, `gym_backup_runs`, and `winback_emails` back the idempotency of the scheduled jobs. |
| **Vercel Hobby is enough** | The app defines **one** cron job — a single daily dispatcher that runs the daily/weekly/monthly work itself. Hobby allows up to 100 cron jobs but runs each **at most once per day**, so one daily cron sidesteps that limit entirely (no Pro needed). |

> Set `RESEND_FROM_EMAIL` to something like `no-reply@yourgym.com` on the verified
> domain. Member-facing invoice/welcome mail is sent "from" the gym's name;
> platform mail (gym-onboarding welcome, renewal reminders, weekly backups) is
> sent "from" GymFlow Pro.

---

## What gets sent automatically

| Trigger | Email | Where |
|---------|-------|-------|
| **New gym onboarded** (admin panel) | Platform **welcome** to the owner: congrats + feature tour + plan & next-renewal date | `actions/admin.ts` → `lib/admin/gym-welcome-content.ts` + `sendPlatformEmail` |
| **Any payment recorded** (record payment, assign plan, renew) | Invoice receipt + PDF | `actions/payments.ts`, `actions/memberships.ts` → `lib/payments/auto-invoice.ts` |
| **New member added** (add-member form, or join-request approval) | Long-form **welcome**: congrats + plan details + gym rules + invoice PDF | `actions/members.ts`, `actions/join.ts` → `lib/payments/invoice-delivery.ts` (`buildWelcomeEmail`) |
| **Membership expiring/expired** | **Renewal reminders** at 7 / 3 / 1 days before and 1 day after | daily dispatcher → `lib/members/reminders.ts` |
| **Every Monday** | **Full gym data backup** as an Excel file to the owner | daily dispatcher (Mondays) → `lib/admin/weekly-backup.ts` |
| **1st of each month** | **Win-back email** to archived (left-the-gym) members, for up to 6 months, with a rejoin link | daily dispatcher (1st) → `lib/members/winback.ts` |

Owner-facing manual triggers (same engines, run on demand):
- **Renewals page → "Email reminders"** (owners/managers).
- **Admin console → "Email backups now"** (super-admin; processes up to 25 gyms per click).

---

## Manual service pause (admin)

A super-admin can pause a gym's service (e.g. after its plan lapsed and the manual
grace-period call/mail went unanswered). This is **fully manual** — no cron — you
decide when to pause and resume.

- **Where:** Admin console → each gym row has a **Pause / Resume** button and a
  **"Paused"** badge. Backed by `adminSetGymPausedAction` → `subscriptions.paused_at`
  (migration `0027`). It's independent of the billing `status`, so pausing never
  clobbers the plan.
- **What the gym owner/staff see when paused:**
  - They land on the **dashboard only**, with a red **scrolling marquee** banner:
    *"Your services have been stopped due to plan expiry…"* plus **Call** and
    **WhatsApp** buttons (from `NEXT_PUBLIC_SUPPORT_WHATSAPP`).
  - Every other route (members, payments, renewals, plans, settings, requests,
    invoices) is redirected to the dashboard by `proxy.ts`.
  - Key write actions (record payment, assign/renew membership, add/edit member)
    are blocked server-side via `currentGymPaused()` — belt-and-suspenders.
- **Resume:** click Resume; `paused_at` is cleared and access returns immediately.

Files: `lib/billing/pause.ts`, `components/billing/service-paused-banner.tsx`,
`app/(app)/layout.tsx`, `src/proxy.ts`, `components/admin/pause-gym-button.tsx`.

> **Requires `NEXT_PUBLIC_SUPPORT_WHATSAPP`** (international digits, e.g.
> `919812345678`) for the Call + WhatsApp buttons. `NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER`
> is also accepted. This same number powers the plan-expiry "Renew on WhatsApp" link.

---

## Staff management (gym owner)

Gym owners can invite staff to help run the gym, from **Settings → Staff**
(owner/super-admin only).

- **Invite by email** → `inviteStaffAction` uses Supabase's `inviteUserByEmail`
  and tags the invitee with `gym_id` + `invited_role: 'staff'` in secure
  `app_metadata`. The invitee sets a password on the **/accept-invite** page
  (`accept_staff_invite` RPC) and joins as `staff`.
- **Team list** shows the gym's owner(s) + staff with role badges; **Remove**
  (`removeStaffAction`, owner-only) deletes a staff member's auth account, which
  cascades their profile and revokes access immediately. Owners aren't removable.
- **What staff can do:** manage members, plans, payments, renewals (RLS scopes
  to their gym). **What they can't:** change billing/subscription, pause/resume,
  invite other staff, or see Settings/Requests — all owner-only.

> ⚠️ The staff **invite email is sent by Supabase Auth**, not Resend. Configure
> **Supabase → Authentication → Email/SMTP** (and the "Invite user" template) for
> invites to actually deliver. Everything else here (accept flow, roles, RLS,
> removal) works without Resend.

Files: `actions/auth.ts` (`inviteStaffAction`, `removeStaffAction`),
`components/settings/staff-manager.tsx`, `app/(app)/settings/page.tsx`,
`app/(auth)/accept-invite/*`.

---

## Cron jobs

Defined in [`vercel.json`](../vercel.json). **Vercel runs cron schedules in UTC.**

A **single daily cron** hits one dispatcher, which decides what to run each day
(all comparisons in UTC). This keeps us to one cron job — well within Hobby, where
each cron runs **at most once per day**.

| Path | Schedule (UTC) | Runs | Idempotency |
|------|----------------|------|-------------|
| `/api/cron/daily` | `0 4 * * *` (daily 04:00) | **Every day:** renewal reminders. **Mondays:** gym backups. **1st of month:** win-back emails. | `renewal_reminders` (subscription, offset) · `gym_backup_runs` (gym, week) · `winback_emails` (member, month) |

The endpoint accepts `GET` or `POST`. The per-job routes (`/api/cron/renewal-reminders`,
`/api/cron/weekly-gym-backup`, `/api/cron/winback-archived`) still exist for manual
one-off runs, but aren't scheduled — the daily dispatcher drives everything.

> Hobby runs each cron at most once per day with ±59-min timing precision — fine
> for these jobs. Every underlying job is idempotent, so the daily dispatcher is
> safe to re-run; the **"Email backups now"** / **"Send win-back emails"** buttons
> are the manual retries for anything that failed.

### Authentication

Each cron endpoint requires `CRON_SECRET`:

- **Vercel Cron** automatically sends `Authorization: Bearer $CRON_SECRET`.
- **Manual / testing** — either header or a `?secret=` query param:

  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" \
    https://app.yourgym.com/api/cron/daily

  # Per-job routes still work for manual one-off runs:
  curl "https://app.yourgym.com/api/cron/winback-archived?secret=$CRON_SECRET"
  ```

Behavior:
- `CRON_SECRET` **unset** → `500` ("refusing to run"). The jobs never run unguarded.
- Wrong/missing secret → `401`.
- Success → `200` with a JSON summary, e.g.
  `{ "ok": true, "processed": 3, "sent": 1, "failed": 2, "alreadyDone": 0, ... }`.

> `/api/cron/*` is allow-listed in [`src/proxy.ts`](../src/proxy.ts) so these
> endpoints are reachable without a logged-in session (they authenticate with the
> secret instead).

---

## How the weekly backup scales

`sendWeeklyGymBackups` is built to grow:

- **Idempotent per week** (`gym_backup_runs`, keyed on the Monday date) — safe to
  run repeatedly; a gym is never emailed twice in a week. This is what makes the
  manual "Email backups now" button (and an optional Pro safety-net run) safe.
- **Bounded concurrency** — 5 gyms processed in parallel (`CONCURRENCY` in
  `lib/admin/weekly-backup.ts`), keeping memory and Resend rate in check.
- **Fail-safe** — if the log table can't be read, the job aborts and sends
  nothing (rather than assuming no one is backed up and mass-emailing).
- **maxDuration = 300s** on the route for the full pass.

**Ceiling:** one invocation comfortably handles **hundreds** of gyms. Beyond
**~500 gyms**, move to a queue-based fan-out (e.g. QStash or Inngest) where each
gym is its own job. Sketch for later:

1. The Monday cron enqueues one message per gym still pending this week.
2. A worker endpoint processes a single gym per message (build workbook → email →
   upsert `gym_backup_runs`), with the queue handling retries/backoff.
3. Keep `gym_backup_runs` as the idempotency guard so re-delivered messages don't
   double-send.

Not needed at the current horizon — noted so it's captured for when you get there.

---

## Testing locally

```bash
# Dev server with local env
npm run dev

# Trigger the daily dispatcher (CRON_SECRET must be set in .env.local)
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/daily
# …or a single job directly:
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/winback-archived
```

With an unverified Resend domain, only your Resend account email receives mail —
point a test member's / owner's email at it to see a real send end-to-end.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Cron returns `500 "CRON_SECRET is not set"` | `CRON_SECRET` missing in Vercel env. |
| Cron returns `401` | Secret mismatch (check the Vercel env value / the header). |
| Summary shows all `failed` with a "verify a domain" error | Resend domain not verified — mail only reaches your account email. |
| Backup summary shows `"…gym_backup_runs…" not found` | Migration `0026` not applied. |
| Reminders never send | Migration `0025` not applied, or no members hit the 7/3/1/-1 day offsets. |
| Cron not firing on Vercel | Confirm the single `/api/cron/daily` job appears under Project → Cron Jobs. Remember Hobby timing is ±59 min, so a 04:00 job may run up to 04:59 UTC. |
| A job failed and wasn't retried | The daily dispatcher re-runs each idempotent job the next day; for an immediate retry use the manual buttons (**"Email reminders"**, **"Email backups now"**, **"Send win-back emails"**). |
