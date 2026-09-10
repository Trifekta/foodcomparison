-- Private storage for customer screenshots.
--
-- Screenshots routinely contain a customer's address, name and order history, so
-- the bucket is private: admins view them through short-lived signed URLs, and
-- uploads happen server-side after the file's magic bytes have been checked.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submission-images',
  'submission-images',
  false,
  10485760, -- 10 MB
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Admins may read and manage objects in this bucket. Anonymous users get
-- nothing: the customer uploads via the server route, which uses the service role.
drop policy if exists "submission_images_admin_select" on storage.objects;
create policy "submission_images_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'submission-images' and public.is_admin());

drop policy if exists "submission_images_admin_insert" on storage.objects;
create policy "submission_images_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'submission-images' and public.is_admin());

drop policy if exists "submission_images_admin_update" on storage.objects;
create policy "submission_images_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'submission-images' and public.is_admin());

drop policy if exists "submission_images_admin_delete" on storage.objects;
create policy "submission_images_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'submission-images' and public.is_admin());
