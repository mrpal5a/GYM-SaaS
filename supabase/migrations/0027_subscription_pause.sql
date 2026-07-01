-- 0027_subscription_pause.sql
-- Manual service pause: when a super-admin pauses a gym (e.g. after its plan
-- lapsed and grace follow-ups went unanswered), `paused_at` is set and the app
-- blocks that gym's owner + staff until it's cleared. Independent of the billing
-- `status` so pause/resume doesn't clobber the plan state. Existing RLS on
-- `subscriptions` already covers reads (gym-scoped) and writes (super_admin).

alter table public.subscriptions
  add column if not exists paused_at timestamptz;
