-- KLYX provider-verification Storage hardening.
--
-- Provider verification documents are uploaded directly from the authenticated
-- browser to Supabase Storage before their metadata is registered through the
-- server API. The bucket and its authorization boundary therefore need to be
-- reproducible in migrations and must not depend on dashboard-only settings.

begin;

-- Keep the bucket private and make the UI/API's existing 10 MiB + MIME
-- contract authoritative at the Storage API boundary for every new upload.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'provider-verification',
  'provider-verification',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Named permissive policies provide the intended access when no historical
-- dashboard policy exists. Matching restrictive policies make the same rules
-- an AND-condition if a broader permissive policy was created previously.
-- The `bucket_id <> ...` branch keeps these restrictive policies neutral for
-- every unrelated KLYX bucket.

drop policy if exists klyx_provider_verification_insert
  on storage.objects;
drop policy if exists klyx_provider_verification_insert_guard
  on storage.objects;
drop policy if exists klyx_provider_verification_select
  on storage.objects;
drop policy if exists klyx_provider_verification_select_guard
  on storage.objects;
drop policy if exists klyx_provider_verification_delete
  on storage.objects;
drop policy if exists klyx_provider_verification_delete_guard
  on storage.objects;
drop policy if exists klyx_provider_verification_update_guard
  on storage.objects;

create policy klyx_provider_verification_insert
on storage.objects
as permissive
for insert
to authenticated
with check (
  bucket_id = 'provider-verification'
  and owner_id = (select auth.uid()::text)
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[2] in (
    'identity',
    'address',
    'business',
    'insurance',
    'professional_certificate'
  )
  and lower(coalesce(storage.extension(name), '')) in (
    'pdf',
    'jpg',
    'jpeg',
    'png',
    'webp'
  )
  and exists (
    select 1
    from public.profiles as profile
    where profile.id::text = (storage.foldername(name))[1]
      and profile.owner_user_id = (select auth.uid())
      and profile.account_type = 'provider'
  )
);

create policy klyx_provider_verification_insert_guard
on storage.objects
as restrictive
for insert
to authenticated
with check (
  bucket_id <> 'provider-verification'
  or (
    owner_id = (select auth.uid()::text)
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] in (
      'identity',
      'address',
      'business',
      'insurance',
      'professional_certificate'
    )
    and lower(coalesce(storage.extension(name), '')) in (
      'pdf',
      'jpg',
      'jpeg',
      'png',
      'webp'
    )
    and exists (
      select 1
      from public.profiles as profile
      where profile.id::text = (storage.foldername(name))[1]
        and profile.owner_user_id = (select auth.uid())
        and profile.account_type = 'provider'
    )
  )
);

-- SELECT is required by the Storage API to return uploaded object metadata and
-- by the current browser cleanup path. It is limited to the uploader's own
-- provider-profile folder in this private bucket.
create policy klyx_provider_verification_select
on storage.objects
as permissive
for select
to authenticated
using (
  bucket_id = 'provider-verification'
  and owner_id = (select auth.uid()::text)
  and exists (
    select 1
    from public.profiles as profile
    where profile.id::text = (storage.foldername(name))[1]
      and profile.owner_user_id = (select auth.uid())
      and profile.account_type = 'provider'
  )
);

create policy klyx_provider_verification_select_guard
on storage.objects
as restrictive
for select
to authenticated
using (
  bucket_id <> 'provider-verification'
  or (
    owner_id = (select auth.uid()::text)
    and exists (
      select 1
      from public.profiles as profile
      where profile.id::text = (storage.foldername(name))[1]
        and profile.owner_user_id = (select auth.uid())
        and profile.account_type = 'provider'
    )
  )
);

create policy klyx_provider_verification_delete
on storage.objects
as permissive
for delete
to authenticated
using (
  bucket_id = 'provider-verification'
  and owner_id = (select auth.uid()::text)
  and exists (
    select 1
    from public.profiles as profile
    where profile.id::text = (storage.foldername(name))[1]
      and profile.owner_user_id = (select auth.uid())
      and profile.account_type = 'provider'
  )
);

create policy klyx_provider_verification_delete_guard
on storage.objects
as restrictive
for delete
to authenticated
using (
  bucket_id <> 'provider-verification'
  or (
    owner_id = (select auth.uid()::text)
    and exists (
      select 1
      from public.profiles as profile
      where profile.id::text = (storage.foldername(name))[1]
        and profile.owner_user_id = (select auth.uid())
        and profile.account_type = 'provider'
    )
  )
);

-- The UI intentionally uploads with upsert=false. A modified browser must not
-- overwrite an already-submitted verification object in place, even if an old
-- permissive UPDATE policy happens to exist.
create policy klyx_provider_verification_update_guard
on storage.objects
as restrictive
for update
to authenticated
using (bucket_id <> 'provider-verification')
with check (bucket_id <> 'provider-verification');

commit;
