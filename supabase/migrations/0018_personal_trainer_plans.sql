-- 0018_personal_trainer_plans.sql
-- Personal Trainer plans: a second category of plan a member can buy *alongside*
-- their gym membership. Modeled as a `kind` discriminator on the existing plan and
-- subscription tables so the whole catalog / payment / renewal machinery is reused.
--
--   kind = 'membership'        -> the gym membership (one active per member, drives
--                                 member_with_status)
--   kind = 'personal_trainer'  -> an independent PT subscription (one active per
--                                 member), tracked + billed separately.

create type plan_kind as enum ('membership', 'personal_trainer');

alter table public.membership_plans
  add column kind plan_kind not null default 'membership';

alter table public.member_subscriptions
  add column kind plan_kind not null default 'membership';

create index member_subs_kind_idx
  on public.member_subscriptions(member_id, kind, status);

-- member_with_status must reflect the *membership* only — a member's PT
-- subscription should never be mistaken for their gym membership. Re-scope the
-- lateral join to kind = 'membership'.
create or replace view public.member_with_status
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

-- assign_membership: now scoped to membership-kind plans + subscriptions, so it
-- never touches a member's Personal Trainer subscription.
create or replace function public.assign_membership(
  p_member_id  uuid,
  p_plan_id    uuid,
  p_start_date date default current_date
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym        uuid := public.current_gym_id();
  v_role       text := public.current_role_name();
  v_member_gym uuid;
  v_plan_name  text;
  v_duration   integer;
  v_sub_id     uuid;
begin
  select gym_id into v_member_gym from public.members where id = p_member_id;
  if v_member_gym is null then
    raise exception 'member not found';
  end if;
  if v_role is distinct from 'super_admin' and v_member_gym is distinct from v_gym then
    raise exception 'forbidden: member belongs to another gym';
  end if;

  select name, duration_days into v_plan_name, v_duration
  from public.membership_plans
  where id = p_plan_id and gym_id = v_member_gym and kind = 'membership';
  if v_plan_name is null then
    raise exception 'plan not found';
  end if;

  update public.member_subscriptions
    set status = 'cancelled'
  where member_id = p_member_id and status = 'active' and kind = 'membership';

  insert into public.member_subscriptions
    (gym_id, member_id, plan_id, plan_name, start_date, end_date, status, kind)
  values
    (v_member_gym, p_member_id, p_plan_id, v_plan_name,
     p_start_date, p_start_date + v_duration, 'active', 'membership')
  returning id into v_sub_id;

  return v_sub_id;
end;
$$;

grant execute on function public.assign_membership(uuid, uuid, date) to authenticated;

-- assign_personal_trainer: the PT counterpart. Cancels any active PT subscription
-- and creates a new one; leaves the gym membership untouched.
create or replace function public.assign_personal_trainer(
  p_member_id  uuid,
  p_plan_id    uuid,
  p_start_date date default current_date
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym        uuid := public.current_gym_id();
  v_role       text := public.current_role_name();
  v_member_gym uuid;
  v_plan_name  text;
  v_duration   integer;
  v_sub_id     uuid;
begin
  select gym_id into v_member_gym from public.members where id = p_member_id;
  if v_member_gym is null then
    raise exception 'member not found';
  end if;
  if v_role is distinct from 'super_admin' and v_member_gym is distinct from v_gym then
    raise exception 'forbidden: member belongs to another gym';
  end if;

  select name, duration_days into v_plan_name, v_duration
  from public.membership_plans
  where id = p_plan_id and gym_id = v_member_gym and kind = 'personal_trainer';
  if v_plan_name is null then
    raise exception 'personal trainer plan not found';
  end if;

  update public.member_subscriptions
    set status = 'cancelled'
  where member_id = p_member_id and status = 'active' and kind = 'personal_trainer';

  insert into public.member_subscriptions
    (gym_id, member_id, plan_id, plan_name, start_date, end_date, status, kind)
  values
    (v_member_gym, p_member_id, p_plan_id, v_plan_name,
     p_start_date, p_start_date + v_duration, 'active', 'personal_trainer')
  returning id into v_sub_id;

  return v_sub_id;
end;
$$;

grant execute on function public.assign_personal_trainer(uuid, uuid, date) to authenticated;
