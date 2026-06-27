-- 0021_gym_join_form.sql
-- Gym address + rules, surfaced on the member joining form PDF.
alter table public.gyms
  add column if not exists address text,
  add column if not exists rules   jsonb not null default '[]'::jsonb;
