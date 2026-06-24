-- 0004_create_gym_with_owner.sql
-- Atomic signup: create gym + owner profile + subscription + audit entry.

create or replace function public.create_gym_with_owner(
  p_user_id   uuid,
  p_email     text,
  p_full_name text,
  p_gym_name  text,
  p_slug      text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym_id uuid;
begin
  if p_user_id <> auth.uid() then
    raise exception 'forbidden: user mismatch';
  end if;

  insert into public.gyms (name, slug) values (p_gym_name, p_slug)
  returning id into v_gym_id;

  insert into public.profiles (id, gym_id, role, full_name, email)
  values (p_user_id, v_gym_id, 'gym_owner', p_full_name, p_email);

  update public.gyms set owner_id = p_user_id where id = v_gym_id;

  insert into public.subscriptions (gym_id, plan, status)
  values (v_gym_id, 'starter', 'trialing');

  insert into public.audit_logs (gym_id, actor_id, action, entity, entity_id)
  values (v_gym_id, p_user_id, 'gym.created', 'gym', v_gym_id::text);

  return v_gym_id;
end;
$$;

grant execute on function public.create_gym_with_owner(uuid, text, text, text, text)
  to authenticated;
