# Monthly insights chart on the owner dashboard

**Date:** 2026-06-28
**Status:** Approved

## Problem

The gym owner dashboard has a large chart area showing only a basic revenue bar
chart (last 6 months) with a plain browser tooltip. The owner can't see other
month-by-month signals (new members, expiring memberships, payment volume) at a
glance, and the space is under-used.

## Goal

Turn the chart area into a month-by-month overview: a revenue bar chart for the
last 6 months where hovering any month reveals a rich tooltip with that month's
full breakdown.

## What it shows

A single revenue **bar chart**, last 6 months (oldest → newest). Revenue is the
visual encoding (bar height). Hovering a month shows a styled tooltip card with:

- **Revenue** — ₹ collected that month
- **New members joined** — members who joined that month
- **Memberships expiring** — memberships whose end date falls in that month
- **Payments count** — number of payments recorded that month

It replaces the current `RevenueChart` inside the existing dashboard card (retitled
from "Revenue · last 6 months" to "Monthly overview").

## Data (per month, last 6)

- **Revenue** — sum of `payments.amount` where `paid_at` is in the month.
- **New members** — count of `members` where `joined_at` is in the month.
- **Expiring** — count of `member_subscriptions` (kind = `membership`) whose
  `end_date` is in the month.
- **Payments count** — number of `payments` rows in the month.

Months are bucketed by calendar month in the server's local time, consistent with
the existing dashboard bucketing logic.

## Components & files

1. **`src/lib/dashboard/monthly-stats.ts`** — pure function
   `buildMonthlyStats({ payments, members, subscriptions }, now?) : MonthlyPoint[]`.
   - `MonthlyPoint = { key: string; label: string; revenue: number; newMembers: number; expiring: number; payments: number }`.
   - Produces exactly 6 entries (oldest → newest), zero-filling months with no data.
   - Inputs are minimal row shapes: `payments: { paid_at: string; amount: number }[]`,
     `members: { joined_at: string }[]`, `subscriptions: { end_date: string | null }[]`.
   - No I/O; `now` is injectable for deterministic tests.
2. **`src/lib/dashboard/monthly-stats.test.ts`** — unit tests (TDD): correct month
   bucketing; zero-fill for empty months; month-boundary dates land in the right
   bucket; exactly 6 buckets returned; payments counted vs summed correctly.
3. **`src/components/dashboard/monthly-chart.tsx`** — `"use client"` component using
   Recharts `BarChart` for revenue plus a custom tooltip component styled to match
   the app (card surface, muted labels, ₹ via existing `formatMoney`). Props:
   `{ data: MonthlyPoint[] }`.
4. **`src/app/(app)/dashboard/page.tsx`** — add `joined_at` to the members select;
   add a `member_subscriptions` query (`end_date, kind`, filtered to the 6-month
   window and `kind = 'membership'`); call `buildMonthlyStats`; render
   `<MonthlyChart>` in place of `<RevenueChart>`. Remove the now-unused
   `RevenueChart` import/usage.
5. **`src/components/dashboard/revenue-chart.tsx`** — removed (its only consumer is
   the dashboard, replaced by `MonthlyChart`).
6. **`package.json`** — add `recharts`.

## Data flow

```
dashboard/page.tsx (server)
  ├─ payments (paid_at, amount) — last 6 months        [already fetched]
  ├─ members (joined_at, ...)                            [extend existing select]
  ├─ member_subscriptions (end_date, kind='membership')  [new query, range-filtered]
  ├─ buildMonthlyStats({ payments, members, subscriptions }) -> MonthlyPoint[]
  └─ <MonthlyChart data={points} />   (client, Recharts)
```

## Error handling / edge cases

- Missing or empty data → months are zero-filled; bars render at minimal height;
  the tooltip shows zeros. The function never throws.
- Any query error is treated as empty data, so the dashboard never blocks on it
  (consistent with the existing dashboard's defensive reads).

## Testing

- Unit tests cover `buildMonthlyStats` (all the logic).
- `MonthlyChart` is presentational; add a light jsdom render smoke test if Recharts
  renders cleanly under jsdom, otherwise rely on manual verification in the browser.
- Manual: load the dashboard, confirm 6 bars, hover each month, verify the tooltip
  numbers match the underlying data.

## Notes / risks

- **Bundle size**: Recharts (~100KB+) loads on the dashboard via the client
  component. Accepted per the design decision.
- **React 19 peer deps**: Recharts may emit a peer-dependency warning on install
  with React 19; it works, but will be flagged if anything breaks.

## Out of scope (YAGNI)

- Combined bars+line and small-multiples chart styles.
- 12-month range, drill-downs, CSV export, active-members trend line.
