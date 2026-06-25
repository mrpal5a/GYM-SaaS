-- 0008_member_rls.sql
-- Tenant isolation for Phase 1-3 tables. Same pattern as 0003:
-- super_admin sees all; everyone else is confined to their own gym.
-- Both gym_owner and staff may manage members, plans, subscriptions, payments
-- (operational tables). Writes are additionally pinned to the caller's gym via
-- WITH CHECK so a client can never insert rows into another gym.

alter table public.members              enable row level security;
alter table public.membership_plans     enable row level security;
alter table public.member_subscriptions enable row level security;
alter table public.payments             enable row level security;

-- helper: true when caller may act within the given gym
-- (inlined per-policy to keep the same shape as the Phase 0 policies)

-- MEMBERS
create policy members_select on public.members for select using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);
create policy members_write on public.members for all using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
) with check (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);

-- MEMBERSHIP PLANS
create policy plans_select on public.membership_plans for select using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);
create policy plans_write on public.membership_plans for all using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
) with check (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);

-- MEMBER SUBSCRIPTIONS
create policy subs_select on public.member_subscriptions for select using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);
create policy subs_write on public.member_subscriptions for all using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
) with check (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);

-- PAYMENTS
create policy payments_select on public.payments for select using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);
create policy payments_write on public.payments for all using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
) with check (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);
