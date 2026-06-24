-- 0003_rls_policies.sql
-- Enable RLS and define tenant-isolation policies on all foundation tables.

alter table public.gyms          enable row level security;
alter table public.profiles      enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_logs    enable row level security;

-- The auth admin (access-token hook) must read profiles regardless of RLS
create policy authadmin_read_profiles on public.profiles
  for select to supabase_auth_admin using (true);

-- GYMS
create policy gyms_select on public.gyms for select using (
  public.current_role_name() = 'super_admin' or id = public.current_gym_id()
);
create policy gyms_update on public.gyms for update using (
  public.current_role_name() = 'super_admin'
  or (id = public.current_gym_id() and public.current_role_name() = 'gym_owner')
);

-- PROFILES (read same-gym; users update own profile; owners manage gym profiles)
create policy profiles_select on public.profiles for select using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);
create policy profiles_update_self on public.profiles for update using ( id = auth.uid() );
create policy profiles_owner_manage on public.profiles for all using (
  public.current_role_name() = 'super_admin'
  or (gym_id = public.current_gym_id() and public.current_role_name() = 'gym_owner')
) with check (
  public.current_role_name() = 'super_admin'
  or (gym_id = public.current_gym_id() and public.current_role_name() = 'gym_owner')
);

-- SUBSCRIPTIONS (read same-gym; only owner/super_admin modify)
create policy subs_select on public.subscriptions for select using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);
create policy subs_modify on public.subscriptions for all using (
  public.current_role_name() = 'super_admin'
  or (gym_id = public.current_gym_id() and public.current_role_name() = 'gym_owner')
) with check (
  public.current_role_name() = 'super_admin'
  or (gym_id = public.current_gym_id() and public.current_role_name() = 'gym_owner')
);

-- AUDIT LOGS (read same-gym; inserts happen via SECURITY DEFINER RPCs only)
create policy audit_select on public.audit_logs for select using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);
