-- 0014_join_requests.sql
-- Self-service member onboarding. Prospects (who have no account) submit a join
-- request via a public form reached by scanning the gym's QR code. The gym is
-- identified by an unguessable `gyms.join_token`. The owner then reviews the
-- request and approves or rejects it; on approval it becomes a real member.
--
-- Submissions are written server-side with the service-role client (no anon DB
-- policy needed); owners read + decide under normal RLS.

-- 1. Gym: public join token + UPI payment details ---------------------------------
-- The default derives a url-safe, unguessable token from a uuid (32 hex chars).
-- Being volatile, it backfills every existing row when the column is added and
-- auto-fills new gyms — the create_gym_with_owner RPC (0004) needs no change.
alter table public.gyms
  add column join_token     text not null unique
    default replace(gen_random_uuid()::text, '-', ''),
  add column upi_id         text,
  add column upi_payee_name text;

-- 2. Join request status ----------------------------------------------------------
create type join_request_status as enum ('pending', 'approved', 'rejected');

-- 3. Staging table for prospect submissions ---------------------------------------
create table public.join_requests (
  id                uuid primary key default gen_random_uuid(),
  gym_id            uuid not null references public.gyms(id) on delete cascade,
  -- member details the prospect fills (mirrors public.members)
  full_name         text not null,
  email             text,
  phone             text,
  gender            member_gender,
  date_of_birth     date,
  height_cm         numeric,
  weight_kg         numeric,
  address           text,
  notes             text,
  photo_url         text,
  -- selected plan, snapshotted so the request survives later plan edits
  plan_id           uuid references public.membership_plans(id) on delete set null,
  plan_name         text,
  plan_price        numeric(10,2),
  -- payment
  payment_method    payment_method not null,
  payment_proof_url text,
  -- review workflow
  status            join_request_status not null default 'pending',
  rejection_reason  text,
  reviewed_by       uuid references public.profiles(id) on delete set null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now()
);
create index join_requests_gym_status_idx
  on public.join_requests(gym_id, status, created_at desc);

-- 4. RLS --------------------------------------------------------------------------
-- Owners + staff may read their own gym's requests; only the owner may update them
-- (approve/reject). Inserts arrive via the service-role client only, so there is
-- deliberately NO insert policy (default-deny for authenticated/anon).
alter table public.join_requests enable row level security;

create policy join_requests_select on public.join_requests for select using (
  public.current_role_name() = 'super_admin' or gym_id = public.current_gym_id()
);

create policy join_requests_update on public.join_requests for update using (
  public.current_role_name() = 'super_admin'
  or (gym_id = public.current_gym_id() and public.current_role_name() = 'gym_owner')
) with check (
  public.current_role_name() = 'super_admin'
  or (gym_id = public.current_gym_id() and public.current_role_name() = 'gym_owner')
);
