# Plan-expiry banner on the gym owner dashboard

**Date:** 2026-06-28
**Status:** Approved

## Problem

Gym owners pay a recurring SaaS subscription (yearly/other plans) to use GymFlow.
When a plan is about to lapse, there is no in-app signal, so owners forget to renew
and lose access. We want a hard-to-miss prompt on the owner's dashboard that nudges
them to contact the provider (the super admin) and renew before expiry.

## Goal

Show a red, moving (marquee) banner at the top of the gym owner's dashboard when
their subscription is expiring soon or has already lapsed, with a one-tap WhatsApp
button to start a renewal conversation with the provider.

## Audience

- **Gym owners only** (`ctx.role === "gym_owner"`). Staff never see it.
- Super admins use `/admin`, not `/dashboard`, so they are unaffected.

## Trigger logic

Fetch the gym's single subscription row (`status`, `current_period_end`). RLS
(`subs_select`) already scopes the query to the caller's gym. Then derive state:

| Condition | Severity | Example message |
|---|---|---|
| `status` is `past_due` or `canceled`, **or** `current_period_end` is today/in the past | `expired` | "Your GymFlow plan has expired. Renew now to avoid interruption." |
| `current_period_end` is within 15 days (`0 < daysUntil ≤ 15`) | `expiring` | "Your GymFlow plan will expire in 12 days. Please renew to keep access." |
| otherwise (incl. no subscription row, or `current_period_end` is null and status is active/trialing) | none | — |

Notes:
- `trialing` and `active` both flow through the day-count path, so a trial ending
  soon also warns.
- If there is no subscription row at all, no banner (nothing to warn about).
- Day count uses the existing `daysUntil` helper from `src/lib/members/metrics`.

## UI

A red marquee strip at the very top of the dashboard, **above** the existing
join-requests banner. Always visible — no dismiss/snooze.

- Scrolling warning text (CSS animation). `expired` uses a stronger/darker red than
  `expiring`.
- A **"Renew on WhatsApp"** button linking to
  `https://wa.me/<number>?text=<prefilled>`. The prefill includes the gym name and
  plan, e.g. "Hi, I'd like to renew my GymFlow plan for Iron House Gym."
- Respects `prefers-reduced-motion`: the text stops scrolling and renders statically.
- If the support number env var is unset, the button is hidden but the message still
  shows.

## Components & files

1. **`src/lib/billing/plan-status.ts`** — pure function
   `getPlanBanner({ status, currentPeriodEnd }): { severity: "expiring" | "expired"; days: number } | null`.
   No I/O; fully unit-testable. `days` is the day count for the `expiring` case
   (and is `≤ 0` / unused for `expired`).
2. **`src/lib/billing/support-link.ts`** — reads `NEXT_PUBLIC_SUPPORT_WHATSAPP`,
   normalizes the number, and builds the `wa.me` URL with prefilled text. Returns
   `null` when the env var is unset. Mirrors the existing `site-url.ts` /
   `join-link.ts` pattern.
3. **`src/components/dashboard/plan-expiry-banner.tsx`** — presentational server
   component. Props: `severity`, `message`, `whatsappHref` (nullable). Renders the
   marquee + optional button.
4. **`src/app/globals.css`** — add `@keyframes marquee` and an `.animate-marquee`
   utility next to the existing `pt-*` keyframes, including a `prefers-reduced-motion`
   fallback (no animation).
5. **`src/app/(app)/dashboard/page.tsx`** — when `ctx.role === "gym_owner"`, add the
   subscription fetch (and the gym name, for the WhatsApp prefill) to the existing
   parallel queries; compute the banner via `getPlanBanner`; render
   `<PlanExpiryBanner>` at the top when non-null.
6. **`.env.example`** (and the user's `.env.local`) — document
   `NEXT_PUBLIC_SUPPORT_WHATSAPP` (international format, digits only, e.g.
   `9198XXXXXXXX`). The user sets the real value.

## Data flow

```
dashboard/page.tsx (server, owner only)
  ├─ supabase.from("subscriptions").select("status, current_period_end").maybeSingle()
  ├─ supabase.from("gyms").select("name").eq(id).maybeSingle()  // for prefill
  ├─ getPlanBanner({ status, currentPeriodEnd }) -> banner | null
  ├─ buildSupportWhatsappLink({ gymName, plan, message }) -> href | null
  └─ <PlanExpiryBanner severity message whatsappHref />  (only if banner !== null)
```

## Error handling

- Subscription query error or no row → treat as "no banner" (fail safe; never block
  the dashboard).
- Missing `NEXT_PUBLIC_SUPPORT_WHATSAPP` → message shows, button hidden.
- Missing/invalid `current_period_end` with an active/trialing status → no banner.

## Testing

- `plan-status.test.ts`: expired by past date; expired by `past_due`; expired by
  `canceled`; expiring at exactly 15 days and at 1 day; none at 16+ days; none when
  no row / null period end on active.
- `support-link.test.ts`: builds correct `wa.me` URL with encoded prefill; strips
  non-digits from the number; returns `null` when the env var is absent.
- Matches the existing colocated `*.test.ts` + vitest setup.

## Out of scope (YAGNI)

- Dismiss / snooze.
- Email or SMS reminders.
- Per-gym configurable thresholds (15 days is fixed).
- The banner on any page other than the dashboard.
- Automated billing / payment collection.
