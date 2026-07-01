-- 0025_renewal_reminders.sql
-- Automated renewal-reminder log. One row per (subscription, reminder_type) so the
-- daily job is idempotent: a reminder of a given type is sent at most once per
-- subscription. Rows are written only by the service-role reminder job (RLS
-- bypassed); gym owners/staff may read their own gym's history. No client writes.

create table if not exists public.renewal_reminders (
  id              uuid primary key default gen_random_uuid(),
  gym_id          uuid not null references public.gyms(id) on delete cascade,
  member_id       uuid not null references public.members(id) on delete cascade,
  subscription_id uuid references public.member_subscriptions(id) on delete set null,
  -- days-before-expiry offset as text: "7", "3", "1" (before) or "-1" (after expiry).
  reminder_type   text not null,
  channel         text not null default 'email',
  status          text not null default 'sent',   -- 'sent' | 'failed'
  error           text,
  end_date        date,
  sent_at         timestamptz not null default now()
);

-- Dedup key: a subscription gets each reminder type once. A renewal creates a new
-- subscription (new id), so its reminder counters naturally reset.
create unique index if not exists renewal_reminders_sub_type_idx
  on public.renewal_reminders (subscription_id, reminder_type);

create index if not exists renewal_reminders_gym_idx
  on public.renewal_reminders (gym_id, sent_at desc);

alter table public.renewal_reminders enable row level security;

-- Read-only for the owning gym; super_admin sees all. Writes happen via the
-- service-role client only (no insert/update/delete policies).
create policy renewal_reminders_select on public.renewal_reminders for select using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);
