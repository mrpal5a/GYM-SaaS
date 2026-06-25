-- 0009_member_views_rpc.sql
-- A view that decorates each member with their current membership status, and an
-- RPC to assign a plan atomically (snapshotting plan name + computing end date).

-- member_with_status: latest non-cancelled subscription drives the derived status.
--   none     -> never had a membership
--   active   -> current, expires in > 7 days
--   expiring -> current, expires within 7 days
--   expired  -> end_date in the past
-- security_invoker keeps the caller's RLS in force (no cross-gym leakage).
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
  order by s.end_date desc
  limit 1
) ms on true;

-- assign_membership: cancels any active subscription, then creates a new one whose
-- end_date = start_date + plan duration. SECURITY DEFINER so it can compute across
-- tables, but it re-checks that the member + plan belong to the caller's gym.
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
  v_gym       uuid := public.current_gym_id();
  v_role      text := public.current_role_name();
  v_member_gym uuid;
  v_plan_name text;
  v_duration  integer;
  v_sub_id    uuid;
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
  where id = p_plan_id and gym_id = v_member_gym;
  if v_plan_name is null then
    raise exception 'plan not found';
  end if;

  update public.member_subscriptions
    set status = 'cancelled'
  where member_id = p_member_id and status = 'active';

  insert into public.member_subscriptions
    (gym_id, member_id, plan_id, plan_name, start_date, end_date, status)
  values
    (v_member_gym, p_member_id, p_plan_id, v_plan_name,
     p_start_date, p_start_date + v_duration, 'active')
  returning id into v_sub_id;

  return v_sub_id;
end;
$$;

grant execute on function public.assign_membership(uuid, uuid, date) to authenticated;
