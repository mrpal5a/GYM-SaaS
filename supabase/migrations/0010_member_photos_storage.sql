-- 0010_member_photos_storage.sql
-- Storage bucket for member photos. Public read (unguessable uuid filenames);
-- writes are restricted to the caller's own gym folder via RLS on storage.objects.
-- Object path convention: "<gym_id>/<uuid>.<ext>".

insert into storage.buckets (id, name, public)
values ('member-photos', 'member-photos', true)
on conflict (id) do nothing;

-- Authenticated users may upload only into their own gym's folder.
create policy "member photos insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'member-photos'
    and (storage.foldername(name))[1] = public.current_gym_id()::text
  );

-- ...and may replace/remove objects only within their own gym folder.
create policy "member photos update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'member-photos'
    and (storage.foldername(name))[1] = public.current_gym_id()::text
  );

create policy "member photos delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'member-photos'
    and (storage.foldername(name))[1] = public.current_gym_id()::text
  );
