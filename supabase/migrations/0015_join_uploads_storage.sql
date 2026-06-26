-- 0015_join_uploads_storage.sql
-- Storage for files attached to a public join request: the prospect's photo and
-- their UPI payment screenshot. Public read so the owner can preview them while
-- reviewing (object paths embed the request uuid, so they're unguessable, like the
-- invoices bucket in 0013).
--
-- Writes happen ONLY through the service-role client inside submitJoinRequestAction
-- (the prospect is unauthenticated), and the service role bypasses RLS — so unlike
-- member-photos/invoices there is intentionally no authenticated write policy here.
-- Object path convention: "<gym_id>/<request_id>/{photo,proof}.<ext>".

insert into storage.buckets (id, name, public)
values ('join-uploads', 'join-uploads', true)
on conflict (id) do nothing;
