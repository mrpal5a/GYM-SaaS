-- 0022_admin_console.sql
-- Phase 8 super-admin console: cross-tenant overview + admin onboarding RPC.
-- Both functions are SECURITY DEFINER and self-guard to super_admin.

-- Per-gym overview for the admin dashboard (one row per gym, no N+1).
create or replace function public.admin_gym_overview()
returns table (
  gym_id              uuid,
  name                text,
  slug                text,
  owner_name          text,
  owner_email         text,
  member_count        bigint,
  revenue_total       numeric,
  revenue_this_month  numeric,
  plan                sub_plan,
  status              sub_status,
  current_period_end  timestamptz,
  created_at          timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.current_role_name() <> 'super_admin' then
    raise exception 'forbidden: super_admin only';
  end if;

  return query
  select g.id, g.name, g.slug,
         o.full_name, o.email,
         coalesce(m.cnt, 0),
         coalesce(p.total, 0),
         coalesce(p.month, 0),
         s.plan, s.status, s.current_period_end,
         g.created_at
  from public.gyms g
  left join public.profiles o on o.id = g.owner_id
  left join public.subscriptions s on s.gym_id = g.id
  left join (
    select gym_id, count(*) cnt from public.members
    where is_active group by gym_id
  ) m on m.gym_id = g.id
  left join (
    select gym_id,
           sum(amount) total,
           sum(amount) filter (where paid_at >= date_trunc('month', now())) month
    from public.payments group by gym_id
  ) p on p.gym_id = g.id
  order by g.created_at desc;
end;
$$;

grant execute on function public.admin_gym_overview() to authenticated;

-- Wire up gym + owner profile + subscription for an already-created auth user.
-- The auth user is created by the service-role client in the server action; this
-- function only touches app tables, atomically, after a super_admin check.
create or replace function public.admin_create_gym_with_owner(
  p_user_id    uuid,
  p_email      text,
  p_full_name  text,
  p_gym_name   text,
  p_slug       text,
  p_plan       sub_plan,
  p_period_end timestamptz
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym_id uuid;
begin
  if public.current_role_name() <> 'super_admin' then
    raise exception 'forbidden: super_admin only';
  end if;

  insert into public.gyms (name, slug) values (p_gym_name, p_slug)
  returning id into v_gym_id;

  insert into public.profiles (id, gym_id, role, full_name, email)
  values (p_user_id, v_gym_id, 'gym_owner', p_full_name, p_email);

  update public.gyms set owner_id = p_user_id where id = v_gym_id;

  insert into public.subscriptions (gym_id, plan, status, current_period_end)
  values (v_gym_id, p_plan, 'active', p_period_end);

  insert into public.audit_logs (gym_id, actor_id, action, entity, entity_id, metadata)
  values (v_gym_id, auth.uid(), 'gym.created_by_admin', 'gym', v_gym_id::text,
          jsonb_build_object('owner_id', p_user_id));

  return v_gym_id;
end;
$$;

grant execute on function public.admin_create_gym_with_owner(uuid, text, text, text, text, sub_plan, timestamptz)
  to authenticated;
