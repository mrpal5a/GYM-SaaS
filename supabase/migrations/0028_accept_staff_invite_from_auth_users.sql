-- 0028_accept_staff_invite_from_auth_users.sql
-- FIX: 0011 read the invite context from `auth.jwt() -> 'app_metadata'`, but the
-- invitee's JWT does not reliably expose `app_metadata` to `auth.jwt()`
-- server-side, so accept_staff_invite failed with "invite is missing gym context"
-- even though the admin-set gym_id was present on the user. Read the admin-only
-- app_metadata straight from `auth.users` instead — still NOT user-mutable (only
-- the service-role admin API writes it, in inviteStaffAction). SECURITY DEFINER
-- (owned by the migration role) can read the auth schema.

create or replace function public.accept_staff_invite(p_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_meta     jsonb;
  v_email    text;
  v_gym_id   uuid;
  v_role     text;
  v_existing uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Authoritative, admin-only invite context from auth.users.
  select email, raw_app_meta_data into v_email, v_meta
  from auth.users where id = v_uid;

  v_gym_id := (v_meta ->> 'gym_id')::uuid;
  v_role   := coalesce(v_meta ->> 'invited_role', 'staff');

  if v_gym_id is null then
    raise exception 'invite is missing gym context';
  end if;
  if v_role <> 'staff' then
    raise exception 'invalid invite role';
  end if;
  if not exists (select 1 from public.gyms where id = v_gym_id) then
    raise exception 'invalid gym';
  end if;

  -- Never move an existing member across tenants.
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
