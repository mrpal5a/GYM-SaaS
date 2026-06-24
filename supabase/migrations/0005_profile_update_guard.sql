-- 0005_profile_update_guard.sql
-- Security: prevent privilege escalation via self-service profile updates.
--
-- RLS alone is insufficient here: an UPDATE policy whose USING clause is
-- `id = auth.uid()` uses that same expression as its implicit WITH CHECK, which
-- keeps the row owned by the user but leaves every OTHER column writable. A user
-- could set their own `role` to 'super_admin' or change `gym_id`. Column-level
-- GRANTs can't help because all logged-in users share the single Postgres role
-- `authenticated` (owner vs staff is distinguished only by JWT claims). So we use
-- a BEFORE UPDATE trigger that reads the JWT role and locks protected columns.

create or replace function public.enforce_profile_update_guard()
returns trigger
language plpgsql
as $$
declare
  v_role text := public.current_role_name();
begin
  -- Backend / migration roles (service_role, postgres, supabase_*) bypass the guard.
  if current_user <> 'authenticated' then
    return new;
  end if;

  -- Super admins may change anything.
  if v_role = 'super_admin' then
    return new;
  end if;

  -- Gym owners may manage profiles within their OWN gym, but may not move a
  -- profile to another gym, nor grant the super_admin role.
  if v_role = 'gym_owner' and old.gym_id = public.current_gym_id() then
    if new.gym_id is distinct from old.gym_id then
      raise exception 'cannot move a profile to a different gym';
    end if;
    if new.role = 'super_admin' then
      raise exception 'cannot assign super_admin role';
    end if;
    return new;
  end if;

  -- Everyone else (self-service edit): protected columns are immutable.
  if new.role   is distinct from old.role
     or new.gym_id is distinct from old.gym_id
     or new.id     is distinct from old.id
     or new.email  is distinct from old.email then
    raise exception 'not authorized to modify protected profile fields (role, gym_id, id, email)';
  end if;

  return new;
end;
$$;

create trigger profiles_update_guard
  before update on public.profiles
  for each row execute function public.enforce_profile_update_guard();
