-- 0011_accept_staff_invite_app_metadata.sql
-- SECURITY FIX (privilege escalation): 0006 derived gym_id from
-- `user_metadata`, which is user-mutable (any authenticated user can call
-- auth.updateUser({ data: {...} })). A user could set their own
-- user_metadata.gym_id to an arbitrary gym and call this RPC to insert a
-- 'staff' profile into a gym they were never invited to (cross-tenant
-- privilege escalation).
--
-- Fix: read the invite context from `app_metadata`, which is admin-only and
-- can NOT be modified by the user (only the service_role admin API sets it,
-- in inviteStaffAction). Also refuse to silently relocate a user who already
-- belongs to a different gym.

create or replace function public.accept_staff_invite(p_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_gym_id      uuid := (auth.jwt() -> 'app_metadata' ->> 'gym_id')::uuid;
  v_role        text := coalesce(auth.jwt() -> 'app_metadata' ->> 'invited_role', 'staff');
  v_email       text := auth.jwt() ->> 'email';
  v_existing    uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if v_gym_id is null then
    raise exception 'invite is missing gym context';
  end if;
  if v_role <> 'staff' then
    raise exception 'invalid invite role';
  end if;
  if not exists (select 1 from public.gyms where id = v_gym_id) then
    raise exception 'invalid gym';
  end if;

  -- If a profile already exists, it must belong to the invited gym; never
  -- move an existing member across tenants.
  select gym_id into v_existing from public.profiles where id = v_uid;
  if v_existing is not null and v_existing <> v_gym_id then
    raise exception 'user already belongs to another gym';
  end if;

  insert into public.profiles (id, gym_id, role, email, full_name)
  values (v_uid, v_gym_id, 'staff', coalesce(v_email, ''), p_full_name)
  on conflict (id) do nothing;

  insert into public.audit_logs (gym_id, actor_id, action, entity, entity_id)
  values (v_gym_id, v_uid, 'staff.joined', 'profile', v_uid::text);
end;
$$;

grant execute on function public.accept_staff_invite(text) to authenticated;
