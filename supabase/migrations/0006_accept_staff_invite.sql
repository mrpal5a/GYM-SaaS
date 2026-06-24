-- 0006_accept_staff_invite.sql
-- Staff onboarding: an invited user creates their OWN staff profile.
--
-- RLS intentionally has no INSERT policy letting a user self-insert a profile
-- (that isolation is by design). So acceptance goes through a SECURITY DEFINER
-- RPC that derives gym_id from the invite metadata carried in the user's JWT
-- (set by inviteUserByEmail's `data`), and hard-codes role = 'staff'. The user
-- can never choose their own gym or role here.

create or replace function public.accept_staff_invite(p_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_gym_id uuid := (auth.jwt() -> 'user_metadata' ->> 'gym_id')::uuid;
  v_email  text := auth.jwt() ->> 'email';
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if v_gym_id is null then
    raise exception 'invite is missing gym context';
  end if;
  if not exists (select 1 from public.gyms where id = v_gym_id) then
    raise exception 'invalid gym';
  end if;

  insert into public.profiles (id, gym_id, role, email, full_name)
  values (v_uid, v_gym_id, 'staff', coalesce(v_email, ''), p_full_name)
  on conflict (id) do nothing;

  insert into public.audit_logs (gym_id, actor_id, action, entity, entity_id)
  values (v_gym_id, v_uid, 'staff.joined', 'profile', v_uid::text);
end;
$$;

grant execute on function public.accept_staff_invite(text) to authenticated;
