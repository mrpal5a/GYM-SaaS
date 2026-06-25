-- 0007_member_tables.sql
-- Phase 1-3 feature tables: members, membership plans, member subscriptions, payments.
-- Every table carries gym_id and follows the Phase 0 tenant-isolation pattern.

-- Enums
create type member_gender   as enum ('male', 'female', 'other');
create type membership_state as enum ('active', 'cancelled');
create type payment_method   as enum ('cash', 'card', 'upi', 'bank_transfer', 'other');

-- MEMBERS
create table public.members (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  full_name     text not null,
  email         text,
  phone         text,
  gender        member_gender,
  date_of_birth date,
  height_cm     numeric(5,2),
  weight_kg     numeric(5,2),
  photo_url     text,
  address       text,
  notes         text,
  joined_at     date not null default current_date,
  is_active     boolean not null default true,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index members_gym_idx       on public.members(gym_id);
create index members_gym_name_idx  on public.members(gym_id, full_name);

-- MEMBERSHIP PLANS
create table public.membership_plans (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  name          text not null,
  description   text,
  price         numeric(10,2) not null default 0,
  duration_days integer not null check (duration_days > 0),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create index membership_plans_gym_idx on public.membership_plans(gym_id);

-- MEMBER SUBSCRIPTIONS (a plan assigned to a member for a date range)
-- plan_name is snapshotted so history survives plan edits/deletes.
create table public.member_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  plan_id    uuid references public.membership_plans(id) on delete set null,
  plan_name  text not null,
  start_date date not null default current_date,
  end_date   date not null,
  status     membership_state not null default 'active',
  created_at timestamptz not null default now()
);
create index member_subs_gym_idx    on public.member_subscriptions(gym_id);
create index member_subs_member_idx on public.member_subscriptions(member_id);
create index member_subs_end_idx    on public.member_subscriptions(gym_id, end_date);

-- PAYMENTS (member_name snapshotted so the ledger survives member deletion)
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  gym_id          uuid not null references public.gyms(id) on delete cascade,
  member_id       uuid references public.members(id) on delete set null,
  member_name     text,
  subscription_id uuid references public.member_subscriptions(id) on delete set null,
  amount          numeric(10,2) not null check (amount >= 0),
  method          payment_method not null default 'cash',
  note            text,
  invoice_number  text,
  paid_at         timestamptz not null default now(),
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index payments_gym_idx    on public.payments(gym_id, paid_at desc);
create index payments_member_idx on public.payments(member_id);
