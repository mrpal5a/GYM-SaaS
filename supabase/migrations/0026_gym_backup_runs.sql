-- 0026_gym_backup_runs.sql
-- Idempotency log for the weekly gym-data backup job. One row per (gym, week):
-- once a gym's backup is 'sent' for a given week it is skipped on re-runs, so the
-- job can be chunked, retried, and safely run by a safety-net schedule without
-- ever emailing a gym twice in the same week. Written only by the service-role
-- job; super_admin (and the owning gym) may read.

create table if not exists public.gym_backup_runs (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  -- Monday (date) of the backup week — the idempotency bucket.
  week_start date not null,
  status     text not null,          -- 'sent' | 'failed'
  error      text,
  sent_at    timestamptz not null default now()
);

-- One record per gym per week; the job upserts on this key.
create unique index if not exists gym_backup_runs_gym_week_idx
  on public.gym_backup_runs (gym_id, week_start);

create index if not exists gym_backup_runs_week_idx
  on public.gym_backup_runs (week_start, status);

alter table public.gym_backup_runs enable row level security;

create policy gym_backup_runs_select on public.gym_backup_runs for select using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);
