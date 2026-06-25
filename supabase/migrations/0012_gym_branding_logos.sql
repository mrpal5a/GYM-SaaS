-- 0012_gym_branding_logos.sql
-- Per-tenant branding: each gym gets an optional logo used in the app chrome and
-- on generated invoices. Logos live in a public bucket with unguessable uuid
-- filenames; writes are restricted to the caller's own gym folder via RLS.
-- Object path convention: "<gym_id>/<uuid>.<ext>".

alter table public.gyms add column if not exists logo_url text;

insert into storage.buckets (id, name, public)
values ('gym-logos', 'gym-logos', true)
on conflict (id) do nothing;

-- Only owners/admins of a gym may write into that gym's folder. (gym_owner is the
-- only non-super role that can manage gym settings; staff can read but not write.)
create policy "gym logos insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gym-logos'
    and (storage.foldername(name))[1] = public.current_gym_id()::text
    and public.current_role_name() in ('super_admin', 'gym_owner')
  );

create policy "gym logos update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'gym-logos'
    and (storage.foldername(name))[1] = public.current_gym_id()::text
    and public.current_role_name() in ('super_admin', 'gym_owner')
  );

create policy "gym logos delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'gym-logos'
    and (storage.foldername(name))[1] = public.current_gym_id()::text
    and public.current_role_name() in ('super_admin', 'gym_owner')
  );
