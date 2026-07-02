-- 0029_staff_review_join_requests.sql
-- Let staff (not just the gym owner) approve/reject join requests. Every decision
-- is already stamped with auth.uid() on reviewed_by / created_by, so the owner can
-- always see which staff member approved or rejected a request.
--
-- Two layers opened up: the RLS update policy on join_requests, and the owner-only
-- guard inside the approve_join_request RPC.

-- 1. RLS: allow same-gym owner OR staff to update requests (was owner-only) --------
drop policy if exists join_requests_update on public.join_requests;
create policy join_requests_update on public.join_requests for update using (
  public.current_role_name() = 'super_admin'
  or (
    gym_id = public.current_gym_id()
    and public.current_role_name() in ('gym_owner', 'staff')
  )
) with check (
  public.current_role_name() = 'super_admin'
  or (
    gym_id = public.current_gym_id()
    and public.current_role_name() in ('gym_owner', 'staff')
  )
);

-- 2. RPC: drop the "only the gym owner can approve" guard (keeps gym-match +
--    pending-status checks). Body is otherwise identical to 0019.
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

  -- A non-super-admin caller must belong to the request's gym; owner OR staff may
  -- approve (the RLS update policy above enforces the same on the final update).
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

  -- 1. Create the member from the submitted details.
  insert into public.members
    (gym_id, full_name, email, phone, gender, date_of_birth, height_cm, weight_kg,
     address, notes, photo_url, created_by)
  values
    (v_req.gym_id, v_req.full_name, v_req.email, v_req.phone, v_req.gender,
     v_req.date_of_birth, v_req.height_cm, v_req.weight_kg, v_req.address, v_req.notes,
     v_req.photo_url, auth.uid())
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

  -- 3. Record the payment for the combined total (membership + PT), as a single
  --    transaction. Linked to the membership subscription; the note captures the
  --    breakdown when a trainer plan was included.
  v_total := coalesce(v_req.plan_price, 0) + coalesce(v_req.pt_plan_price, 0);
  if v_total > 0 then
    insert into public.payments
      (gym_id, member_id, member_name, subscription_id, amount, method, note,
       invoice_number, created_by)
    values
      (v_req.gym_id, v_member_id, v_req.full_name, v_sub_id, v_total, v_req.payment_method,
       case
         when v_req.pt_plan_id is not null then
           'Membership: ' || coalesce(v_req.plan_name, '—') ||
           ' + Personal Trainer: ' || coalesce(v_req.pt_plan_name, '—')
         else null
       end,
       p_invoice_number, auth.uid());
  end if;

  -- 4. Mark the request approved.
  update public.join_requests
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id;

  return v_member_id;
end;
$$;

grant execute on function public.approve_join_request(uuid, text) to authenticated;
