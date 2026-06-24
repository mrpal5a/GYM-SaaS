-- 0002_jwt_hook_and_accessors.sql
-- JWT custom-claims access-token hook + RLS accessor functions.

-- Accessors read custom claims from the verified JWT (no table lookup)
create or replace function public.current_gym_id() returns uuid
  language sql stable as $$
    select nullif(auth.jwt() ->> 'gym_id', '')::uuid
  $$;

create or replace function public.current_role_name() returns text
  language sql stable as $$
    select auth.jwt() ->> 'user_role'
  $$;

-- Access-token hook: stamps gym_id + user_role into the JWT at issuance
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_gym_id uuid;
  v_role   text;
  claims   jsonb;
begin
  select gym_id, role::text into v_gym_id, v_role
  from public.profiles where id = (event ->> 'user_id')::uuid;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  if v_gym_id is not null then
    claims := jsonb_set(claims, '{gym_id}', to_jsonb(v_gym_id::text));
  end if;
  if v_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Only the auth admin may execute the hook; it must read profiles
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select on table public.profiles to supabase_auth_admin;
