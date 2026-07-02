# Scaling & capacity

How GymFlow Pro performs, how far the **free tiers** stretch, and what to do as
you grow. Numbers reflect Vercel Hobby + Supabase Free as of mid-2026 — re-check
the pricing pages before relying on them.

---

## Free-tier limits that actually bind us

Members are **database rows, not login accounts** — only owners/staff authenticate.
So Supabase's 50,000 monthly-active-users auth limit is irrelevant. The real
ceilings:

| Limit | Free tier | Consumed by |
|-------|-----------|-------------|
| Supabase **database** | **500 MB** | member / payment / subscription / reminder rows + history |
| Supabase **file storage** | **1 GB** | member photos (~50 KB each after client compression) |
| Supabase **egress** | **5 GB / month** | serving photos, invoice PDFs, page data |
| Vercel **function invocations** | **1M / month** | each page load / server action |
| Vercel **fast data transfer** | **100 GB / month** | all responses |

### Rough capacity

- **Storage:** 1 GB ÷ 50 KB ≈ **~20,000 member photos**.
- **Database:** an active member on monthly renewals produces ~15–25 KB/year (row +
  payments + subscriptions + reminder logs). 500 MB ≈ **~25,000 member-years** —
  i.e. **~2,000–5,000 active members with several years of history**.
- **Invocations:** ~2–3 per page view → 1M/mo ≈ **~10,000 page views/day**.

**Practical target:** roughly **10–50 small gyms / a few thousand members** for a
couple of years on the free tiers. The first limit hit is usually the **500 MB
database** as history accumulates, then **5 GB/mo egress** if browsing is very
photo-heavy.

---

## Performance

The app is already structured for speed: parallel queries (`Promise.all`, no
waterfalls), no N+1 (batched actor/group/reminder loads), client-side photo
compression, gym-scoped indexes + RLS, and PostgREST/HTTP access (no serverless
connection-pool exhaustion).

### The one thing to do before launch: colocate regions

Every DB call is a round trip from the Vercel function to Supabase. If they sit in
different regions that's **+100–300 ms per query**. **Set the Vercel project region
to match the Supabase project region** (e.g. both `ap-south-1` / Mumbai for India).
Free, config-only, biggest real-world win.

### Other levers (in rough priority)

1. **Middleware `getUser()`** runs a network auth check on every request — this is
   the correct *secure* pattern; keep it. It's the fixed per-request cost.
2. **Pause-gate query per navigation** — could be removed by putting `paused` into
   the JWT via the access-token hook. Real win, but touches security-sensitive auth
   code — do it deliberately, with testing.
3. Add an index on `payments(gym_id, source)` only if the source filter ever feels
   slow (negligible at current scale — queries are already gym-scoped + indexed).

---

## Keeping the database small (pruning)

History grows fastest in three tables. When the DB approaches ~400 MB, prune:

- **`renewal_reminders`** — audit rows for sent reminders; safe to delete rows older
  than, say, 12 months.
- **`join_requests`** with `status <> 'pending'` — decided requests are kept only
  for the "recently decided" view; old ones can go.
- **`winback_emails`** — monthly send log; keep ~12 months.
- **`audit_logs`** — trim to a rolling window if it grows.

Do this from the Supabase SQL editor, e.g.:

```sql
delete from public.renewal_reminders where sent_at < now() - interval '12 months';
delete from public.join_requests   where status <> 'pending' and created_at < now() - interval '6 months';
delete from public.winback_emails  where sent_at < now() - interval '12 months';
```

Member photos dominate **file storage** — deleting a member removes their row but
the storage object may linger; sweep orphaned files in `member-photos` if storage
gets tight.

---

## When to leave the free tier

| Signal | Move |
|--------|------|
| Real paying customers / customer data | **Supabase paid** — Free has **no automatic backups or PITR**. The weekly Excel backup email softens this, but isn't a substitute. |
| Commercial launch | **Vercel Pro ($20/mo)** — Hobby is officially non-commercial; Pro also lifts limits and enables per-minute crons. |
| DB > ~450 MB after pruning, or egress routinely near 5 GB/mo | **Supabase paid** (8 GB DB, 250 GB egress on the next tier). |
| Need cron precision / sub-daily jobs | **Vercel Pro** (Hobby crons run once/day, ±59 min). |

### Operational notes

- **Supabase Free pauses a project after 7 days of inactivity.** Not an issue for a
  daily-used gym app; know it exists for staging/idle projects.
- **Backups:** until on a paid Supabase plan, treat the weekly Excel export as the
  recovery path, and consider a scheduled `pg_dump` you store elsewhere.
