-- ============================================================================
-- TradeConnect — 004 STORAGE BUCKETS + POLICIES
--   verification-docs : PRIVATE. Readable by the owner and admins only.
--   job-photos        : public read, owner write (low-res job photos).
-- Objects are stored under "<auth.uid()>/<filename>" so the first path
-- segment is the ownership check.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('verification-docs', 'verification-docs', false, 10485760)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('job-photos', 'job-photos', true, 10485760)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- verification-docs
-- ---------------------------------------------------------------------------
drop policy if exists "verification docs owner insert" on storage.objects;
create policy "verification docs owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "verification docs owner or admin read" on storage.objects;
create policy "verification docs owner or admin read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists "verification docs owner update" on storage.objects;
create policy "verification docs owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "verification docs owner delete" on storage.objects;
create policy "verification docs owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'verification-docs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- job-photos
-- ---------------------------------------------------------------------------
drop policy if exists "job photos public read" on storage.objects;
create policy "job photos public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'job-photos');

drop policy if exists "job photos owner insert" on storage.objects;
create policy "job photos owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "job photos owner delete" on storage.objects;
create policy "job photos owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'job-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
