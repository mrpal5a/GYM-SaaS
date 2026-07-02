-- 0030_attribution_sources.sql
-- Surface "who / when / how" for members and payments. The actor (created_by /
-- reviewed_by) and timestamps already exist; this adds the missing *how* — a
-- source tag distinguishing manual entry from plan-driven auto-records and from
-- join-request approvals — so the owner can tell at a glance how each row got there.

-- 1. Payment source ---------------------------------------------------------------
--    manual        = recorded by hand via the Record Payment form
--    plan          = auto-recorded alongside a plan (signup / assign / renew)
--    join_approval = auto-recorded when a self-service join request was approved
create type payment_source as enum ('manual', 'plan', 'join_approval');
alter table public.payments
  add column source payment_source not null default 'manual';

-- 2. Member source ----------------------------------------------------------------
--    manual        = added by an owner/staff via the Add Member form
--    join_approval = created by approving a self-service join request
create type member_source as enum ('manual', 'join_approval');
alter table public.members
  add column source member_source not null default 'manual';

-- 3. Re-expand member_with_status so members.source surfaces in the view.
--    The view selects m.*, and adding a column shifts m.*'s positions, so drop +
--    recreate (same pattern as migrations 0020 / 0024).
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

-- 4. Approve RPC: stamp the source on the member (join_approval) and the payment
--    (join_approval). Otherwise identical to the 0029 body (staff-allowed).
create or replace function public.approve_join_request(
  p_request_id     uuid,
  p_invoice_number text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym         uuid := public.current_gym_id();
  v_role        text := public.current_role_name();
  v_req         public.join_requests;
  v_duration    integer;
  v_pt_duration integer;
  v_member_id   uuid;
  v_sub_id      uuid;
  v_pt_sub_id   uuid;
  v_total       numeric(10,2);
begin
  select * into v_req from public.join_requests where id = p_request_id;
  if v_req.id is null then
    raise exception 'join request not found';
  end if;

  if v_role is distinct from 'super_admin' then
    if v_req.gym_id is distinct from v_gym then
      raise exception 'forbidden: request belongs to another gym';
    end if;
    if v_role not in ('gym_owner', 'staff') then
      raise exception 'forbidden: not allowed to approve requests';
    end if;
  end if;

  if v_req.status is distinct from 'pending' then
    raise exception 'request is not pending';
  end if;

  -- 1. Create the member (source = join_approval).
  insert into public.members
    (gym_id, full_name, email, phone, gender, date_of_birth, height_cm, weight_kg,
     address, notes, photo_url, created_by, source)
  values
    (v_req.gym_id, v_req.full_name, v_req.email, v_req.phone, v_req.gender,
     v_req.date_of_birth, v_req.height_cm, v_req.weight_kg, v_req.address, v_req.notes,
     v_req.photo_url, auth.uid(), 'join_approval')
  returning id into v_member_id;

  -- 2. Assign the selected membership plan (if it still exists).
  if v_req.plan_id is not null then
    select duration_days into v_duration
    from public.membership_plans
    where id = v_req.plan_id and gym_id = v_req.gym_id;

    if v_duration is not null then
      insert into public.member_subscriptions
        (gym_id, member_id, plan_id, plan_name, start_date, end_date, status, kind)
      values
        (v_req.gym_id, v_member_id, v_req.plan_id, v_req.plan_name,
         current_date, current_date + v_duration, 'active', 'membership')
      returning id into v_sub_id;
    end if;
  end if;

  -- 2b. Assign the optional Personal Trainer plan as an independent subscription.
  if v_req.pt_plan_id is not null then
    select duration_days into v_pt_duration
    from public.membership_plans
    where id = v_req.pt_plan_id and gym_id = v_req.gym_id and kind = 'personal_trainer';

    if v_pt_duration is not null then
      insert into public.member_subscriptions
        (gym_id, member_id, plan_id, plan_name, start_date, end_date, status, kind)
      values
        (v_req.gym_id, v_member_id, v_req.pt_plan_id, v_req.pt_plan_name,
         current_date, current_date + v_pt_duration, 'active', 'personal_trainer')
      returning id into v_pt_sub_id;
    end if;
  end if;

  -- 3. Record the combined payment (source = join_approval).
  v_total := coalesce(v_req.plan_price, 0) + coalesce(v_req.pt_plan_price, 0);
  if v_total > 0 then
    insert into public.payments
      (gym_id, member_id, member_name, subscription_id, amount, method, note,
       invoice_number, created_by, source)
    values
      (v_req.gym_id, v_member_id, v_req.full_name, v_sub_id, v_total, v_req.payment_method,
       case
         when v_req.pt_plan_id is not null then
           'Membership: ' || coalesce(v_req.plan_name, '—') ||
           ' + Personal Trainer: ' || coalesce(v_req.pt_plan_name, '—')
         else null
       end,
       p_invoice_number, auth.uid(), 'join_approval');
  end if;

  -- 4. Mark the request approved.
  update public.join_requests
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id;

  return v_member_id;
end;
$$;

grant execute on function public.approve_join_request(uuid, text) to authenticated;
