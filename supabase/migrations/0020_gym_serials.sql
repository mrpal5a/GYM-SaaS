-- 0020_gym_serials.sql
-- Human-friendly, per-gym serial numbers for members, payments and join requests
-- (e.g. Member #1, #2, … separate from the opaque UUIDs). Each gym gets its own
-- independent sequence per entity, so numbers stay small and memorable and never
-- leak cross-gym volume.
--
-- A counter table + trigger is used (rather than a global Postgres sequence) so the
-- numbering is per-gym and gapless. The row lock taken by the upsert serializes
-- concurrent inserts for the same gym+entity, preventing duplicate serials.

create table if not exists public.gym_sequences (
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  entity     text not null,
  last_value bigint not null default 0,
  primary key (gym_id, entity)
);

-- Internal bookkeeping only — never read/written directly by clients.
alter table public.gym_sequences enable row level security;

-- Assigns the next per-gym serial to NEW.serial. SECURITY DEFINER so it can touch
-- gym_sequences regardless of the caller's RLS; the entity name is passed as the
-- trigger argument (TG_ARGV[0]).
create or replace function public.assign_gym_serial() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity text := tg_argv[0];
  v_next   bigint;
begin
  if NEW.serial is not null then
    return NEW;
  end if;

  insert into public.gym_sequences (gym_id, entity, last_value)
    values (NEW.gym_id, v_entity, 1)
  on conflict (gym_id, entity)
    do update set last_value = public.gym_sequences.last_value + 1
  returning last_value into v_next;

  NEW.serial := v_next;
  return NEW;
end;
$$;

-- 1. Add the serial columns (nullable for now so we can backfill).
alter table public.members        add column if not exists serial bigint;
alter table public.payments       add column if not exists serial bigint;
alter table public.join_requests  add column if not exists serial bigint;

-- 2. Backfill existing rows: number each gym's rows by creation order.
update public.members m
  set serial = r.rn
from (
  select id, row_number() over (partition by gym_id order by created_at, id) as rn
  from public.members
) r
where m.id = r.id;

update public.payments p
  set serial = r.rn
from (
  select id, row_number() over (partition by gym_id order by created_at, id) as rn
  from public.payments
) r
where p.id = r.id;

update public.join_requests j
  set serial = r.rn
from (
  select id, row_number() over (partition by gym_id order by created_at, id) as rn
  from public.join_requests
) r
where j.id = r.id;

-- 3. Seed the counters so new inserts continue after the highest existing serial.
insert into public.gym_sequences (gym_id, entity, last_value)
  select gym_id, 'member', max(serial) from public.members group by gym_id
on conflict (gym_id, entity) do update set last_value = excluded.last_value;

insert into public.gym_sequences (gym_id, entity, last_value)
  select gym_id, 'payment', max(serial) from public.payments group by gym_id
on conflict (gym_id, entity) do update set last_value = excluded.last_value;

insert into public.gym_sequences (gym_id, entity, last_value)
  select gym_id, 'join_request', max(serial) from public.join_requests group by gym_id
on conflict (gym_id, entity) do update set last_value = excluded.last_value;

-- 4. Now every row has a serial — lock it down + auto-assign on insert.
alter table public.members       alter column serial set not null;
alter table public.payments      alter column serial set not null;
alter table public.join_requests alter column serial set not null;

drop trigger if exists members_assign_serial on public.members;
create trigger members_assign_serial
  before insert on public.members
  for each row execute function public.assign_gym_serial('member');

drop trigger if exists payments_assign_serial on public.payments;
create trigger payments_assign_serial
  before insert on public.payments
  for each row execute function public.assign_gym_serial('payment');

drop trigger if exists join_requests_assign_serial on public.join_requests;
create trigger join_requests_assign_serial
  before insert on public.join_requests
  for each row execute function public.assign_gym_serial('join_request');

-- 5. Re-expand member_with_status so members.serial surfaces in the view. A
--    `create or replace view` can't do this (adding serial via `m.*` shifts the
--    column positions, which replace forbids), so drop + recreate instead.
drop view if exists public.member_with_status;
create view public.member_with_status
with (security_invoker = true) as
select
  m.*,
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
left join lateral (
  select s.*
  from public.member_subscriptions s
  where s.member_id = m.id
    and s.status = 'active'
    and s.kind = 'membership'
  order by s.end_date desc
  limit 1
) ms on true;
