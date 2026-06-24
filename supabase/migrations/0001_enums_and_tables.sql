-- 0001_enums_and_tables.sql
-- Phase 0 foundation: enums + tenant-root tables + indexes.

-- Enums
create type app_role  as enum ('super_admin', 'gym_owner', 'staff');
create type sub_plan   as enum ('starter', 'professional', 'enterprise');
create type sub_status as enum ('trialing', 'active', 'past_due', 'canceled');

-- gyms (tenant root)
create table public.gyms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  owner_id   uuid,
  created_at timestamptz not null default now()
);

-- profiles (1:1 with auth.users)
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  gym_id     uuid references public.gyms(id) on delete cascade,
  role       app_role not null default 'staff',
  full_name  text,
  email      text not null,
  created_at timestamptz not null default now()
);
create index profiles_gym_id_idx on public.profiles(gym_id);

-- gyms.owner_id FK now that profiles exists
alter table public.gyms
  add constraint gyms_owner_fk foreign key (owner_id)
  references public.profiles(id) on delete set null;

-- subscriptions (1 per gym)
create table public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  gym_id             uuid not null unique references public.gyms(id) on delete cascade,
  plan               sub_plan   not null default 'starter',
  status             sub_status not null default 'trialing',
  current_period_end timestamptz,
  created_at         timestamptz not null default now()
);

-- audit_logs
create table public.audit_logs (
  id         bigint generated always as identity primary key,
  gym_id     uuid references public.gyms(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null,
  entity     text,
  entity_id  text,
  metadata   jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_gym_created_idx on public.audit_logs(gym_id, created_at desc);
