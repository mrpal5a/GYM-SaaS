-- 0016_approve_join_request.sql
-- Approve a pending join request atomically: create the member from the submitted
-- details, assign the chosen plan (snapshotting name + computing end_date, same as
-- assign_membership in 0009), record the payment (amount = snapshotted plan price),
-- and mark the request approved.
--
-- SECURITY DEFINER so it can write across tables, but it re-checks that the request
-- belongs to the caller's gym, the caller is the gym owner, and the request is still
-- pending. The invoice number is generated in TS (generateInvoiceNumber) and passed
-- in so the format stays identical to other payments.

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
    (gym_id, full_name, email, phone, gender, date_of_birth, height_cm, weight_kg,
     address, notes, photo_url, created_by)
  values
    (v_req.gym_id, v_req.full_name, v_req.email, v_req.phone, v_req.gender,
     v_req.date_of_birth, v_req.height_cm, v_req.weight_kg, v_req.address, v_req.notes,
     v_req.photo_url, auth.uid())
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
