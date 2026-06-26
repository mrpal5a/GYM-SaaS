-- 0017_join_request_rate_limit.sql
-- Rate-limit the public, unauthenticated join form (submitJoinRequestAction).
-- The only gate on that endpoint was the unguessable join_token; once a link is
-- shared, anyone holding it could spam join_requests rows + image uploads. This
-- adds a durable, multi-instance-safe limiter (in-memory counters don't survive
-- serverless cold starts / multiple instances), reusing the existing service-role
-- client — no new infra or dependency.
--
-- Two fixed-window limits per call:
--   * per (gym, ip)  — stops one client hammering a single join link.
--   * per gym        — caps total intake so distributed spam can't fill storage.
-- Exceeding EITHER denies the request without recording an attempt.

-- 1. Attempt log ------------------------------------------------------------------
create table public.join_request_attempts (
  id         bigint generated always as identity primary key,
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  ip         text not null,
  created_at timestamptz not null default now()
);
create index join_request_attempts_gym_created_idx
  on public.join_request_attempts(gym_id, created_at desc);

-- Default-deny: only the service-role client (which bypasses RLS) ever touches
-- this table, via register_join_attempt below. No policies = no anon/authenticated
-- access.
alter table public.join_request_attempts enable row level security;

-- 2. Limiter ----------------------------------------------------------------------
-- Returns true and records the attempt when under both limits; returns false
-- (recording nothing) when either limit is hit. SECURITY DEFINER so it can write
-- regardless of the caller, but it is locked to the service_role grant below so it
-- can't be invoked directly with the public anon key via PostgREST.
create or replace function public.register_join_attempt(
  p_gym_id         uuid,
  p_ip             text,
  p_max_per_ip     integer,
  p_max_per_gym    integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff    timestamptz := now() - make_interval(secs => p_window_seconds);
  v_ip_count  integer;
  v_gym_count integer;
begin
  -- Opportunistic cleanup keeps the table bounded to ~one window of this gym's
  -- traffic instead of growing forever.
  delete from public.join_request_attempts
    where gym_id = p_gym_id and created_at < v_cutoff;

  select
    count(*) filter (where ip = p_ip),
    count(*)
  into v_ip_count, v_gym_count
  from public.join_request_attempts
  where gym_id = p_gym_id and created_at > v_cutoff;

  if v_ip_count >= p_max_per_ip or v_gym_count >= p_max_per_gym then
    return false;
  end if;

  insert into public.join_request_attempts (gym_id, ip) values (p_gym_id, p_ip);
  return true;
end;
$$;

revoke execute on function
  public.register_join_attempt(uuid, text, integer, integer, integer) from public;
grant execute on function
  public.register_join_attempt(uuid, text, integer, integer, integer) to service_role;
