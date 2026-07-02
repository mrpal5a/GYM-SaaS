-- 0031_member_groups.sql
-- Group members who joined together (friends / family), so from any one member you
-- can see everyone else in their group. A member belongs to at most one group
-- (members.group_id); groups are auto-named after the member who started them and
-- can be renamed later. Same tenant-isolation pattern as the other feature tables.

-- 1. Groups table -----------------------------------------------------------------
create table public.member_groups (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  name       text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index member_groups_gym_idx on public.member_groups(gym_id);

-- 2. Members -> group link (nullable; clearing a group just detaches its members) --
alter table public.members
  add column group_id uuid references public.member_groups(id) on delete set null;
create index members_group_idx on public.members(group_id);

-- 3. RLS: same-gym read; owner + staff write (operational table, like members) -----
alter table public.member_groups enable row level security;
create policy member_groups_select on public.member_groups for select using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);
create policy member_groups_write on public.member_groups for all using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
) with check (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);

-- 4. Re-expand member_with_status so members.group_id surfaces AND the group name
--    rides along (for the members-list badge) without an extra query. Drop +
--    recreate because m.* column positions shift (same pattern as 0024 / 0030).
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
