-- 0024_member_emergency_phone.sql
-- Capture an alternate / emergency contact number for members. It is required on
-- the public join form (enforced in the app's joinRequestSchema) and optional for
-- the owner's manual member entry; the column itself is nullable so existing rows
-- and walk-ins without one are fine.

-- 1. New column on both the staging table and the members table -------------------
alter table public.members       add column emergency_phone text;
alter table public.join_requests add column emergency_phone text;

-- 2. Re-expand member_with_status so members.emergency_phone surfaces in the view.
--    The view selects m.*, and `create or replace view` can't add a column through
--    m.* (it shifts column positions), so drop + recreate — same as migration 0020.
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

-- 3. Carry emergency_phone over when a join request is approved -------------------
--    Identical to 0016 except the members insert now includes emergency_phone.
create or replace function public.approve_join_request(
  p_request_id     uuid,
  p_invoice_number text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym       uuid := public.current_gym_id();
  v_role      text := public.current_role_name();
  v_req       public.join_requests;
  v_duration  integer;
  v_member_id uuid;
  v_sub_id    uuid;
begin
  select * into v_req from public.join_requests where id = p_request_id;
  if v_req.id is null then
    raise exception 'join request not found';
  end if;

  if v_role is distinct from 'super_admin' then
    if v_req.gym_id is distinct from v_gym then
      raise exception 'forbidden: request belongs to another gym';
    end if;
    if v_role is distinct from 'gym_owner' then
      raise exception 'forbidden: only the gym owner can approve requests';
    end if;
  end if;

  if v_req.status is distinct from 'pending' then
    raise exception 'request is not pending';
  end if;

  -- 1. Create the member from the submitted details.
  insert into public.members
    (gym_id, full_name, email, phone, emergency_phone, gender, date_of_birth,
     height_cm, weight_kg, address, notes, photo_url, created_by)
  values
    (v_req.gym_id, v_req.full_name, v_req.email, v_req.phone, v_req.emergency_phone,
     v_req.gender, v_req.date_of_birth, v_req.height_cm, v_req.weight_kg, v_req.address,
     v_req.notes, v_req.photo_url, auth.uid())
  returning id into v_member_id;

  -- 2. Assign the selected plan (if it still exists), computing the end date.
  if v_req.plan_id is not null then
    select duration_days into v_duration
    from public.membership_plans
    where id = v_req.plan_id and gym_id = v_req.gym_id;

    if v_duration is not null then
      insert into public.member_subscriptions
        (gym_id, member_id, plan_id, plan_name, start_date, end_date, status)
      values
        (v_req.gym_id, v_member_id, v_req.plan_id, v_req.plan_name,
         current_date, current_date + v_duration, 'active')
      returning id into v_sub_id;
    end if;
  end if;

  -- 3. Record the payment (amount = snapshotted plan price, method as submitted).
  if v_req.plan_price is not null then
    insert into public.payments
      (gym_id, member_id, member_name, subscription_id, amount, method,
       invoice_number, created_by)
    values
      (v_req.gym_id, v_member_id, v_req.full_name, v_sub_id, v_req.plan_price,
       v_req.payment_method, p_invoice_number, auth.uid());
  end if;

  -- 4. Mark the request approved.
  update public.join_requests
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id;

  return v_member_id;
end;
$$;

grant execute on function public.approve_join_request(uuid, text) to authenticated;
