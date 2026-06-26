-- 0013_invoice_pdfs_storage.sql
-- Storage bucket for generated invoice PDFs. These are shared via WhatsApp as a
-- public download link, so the bucket is public-read — but object paths embed the
-- payment's UUID ("<gym_id>/<payment_id>.pdf"), which is unguessable, exactly like
-- the member-photos bucket (see 0010). Writes are restricted to the caller's own
-- gym folder via RLS on storage.objects; re-sending upserts the same path.

insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', true)
on conflict (id) do nothing;

-- Authenticated users may upload only into their own gym's folder.
create policy "invoices insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = public.current_gym_id()::text
  );

-- ...and may replace/remove objects only within their own gym folder.
create policy "invoices update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = public.current_gym_id()::text
  );

create policy "invoices delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = public.current_gym_id()::text
  );
