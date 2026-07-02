-- 0032_member_archive.sql
-- Archive members who left the gym: they drop out of the active Members list,
-- Renewals, and renewal reminders, and instead receive a monthly win-back email
-- (for up to 6 months) inviting them to rejoin. Archiving is reversible (restore).

-- 1. Archive flag: null = active, timestamp = when archived. -----------------------
alter table public.members
  add column archived_at timestamptz;
create index members_gym_archived_idx on public.members(gym_id, archived_at);

-- 2. Re-expand member_with_status so members.archived_at surfaces in the view.
--    m.* shifts positions when a column is added, so drop + recreate (identical to
--    0031 otherwise — archived_at rides along via m.*).
drop view if exists public.member_with_status;
create view public.member_with_status
with (security_invoker = true) as
select
  m.*,
  g.name        as group_name,
  ms.id         as subscription_id,
  ms.plan_id    as plan_id,
  ms.plan_name  as plan_name,
  ms.start_date as start_date,
  ms.end_date   as end_date,
  case
    when ms.id is null               then 'none'
    when ms.end_date < current_date  then 'expired'
    when ms.end_date <= current_date + 7 then 'expiring'
    else 'active'
  end as membership_status
from public.members m
left join public.member_groups g on g.id = m.group_id
left join lateral (
  select s.*
  from public.member_subscriptions s
  where s.member_id = m.id
    and s.status = 'active'
    and s.kind = 'membership'
  order by s.end_date desc
  limit 1
) ms on true;

-- 3. Win-back email log — one row per member per calendar month, for idempotency
--    (the monthly cron is safe to re-run) and a simple audit trail. Mirrors the
--    renewal_reminders design. Inserts happen via the service-role cron only.
create table public.winback_emails (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  period     text not null,               -- 'YYYY-MM' the email was sent for
  status     text not null,               -- 'sent' | 'failed'
  error      text,
  sent_at    timestamptz not null default now(),
  unique (member_id, period)
);
create index winback_emails_gym_idx on public.winback_emails(gym_id, sent_at desc);

alter table public.winback_emails enable row level security;
-- Owners + staff may read their gym's win-back log; writes are service-role only.
create policy winback_emails_select on public.winback_emails for select using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);
