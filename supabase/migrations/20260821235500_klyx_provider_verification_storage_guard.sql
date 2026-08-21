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

-- Authenticated roles intentionally cannot SELECT the profiles table directly
-- after KLYX privilege hardening. Storage RLS therefore resolves only the
-- minimum ownership predicate through this SECURITY DEFINER helper instead of
-- reopening profile-table reads to the browser.
create or replace function public.klyx_owns_provider_verification_path(
  p_name text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and array_length(storage.foldername(p_name), 1) = 2
    and exists (
      select 1
      from public.profiles as profile
      where profile.id::text = (storage.foldername(p_name))[1]
        and profile.owner_user_id = auth.uid()
        and profile.account_type = 'provider'
    );
$$;

revoke all on function public.klyx_owns_provider_verification_path(text)
  from public, anon;
grant execute on function public.klyx_owns_provider_verification_path(text)
  to authenticated, service_role;

comment on function public.klyx_owns_provider_verification_path(text) is
  'Minimal Storage RLS helper: true only when the authenticated account owns the provider profile named by the first object-path folder.';

-- Browser cleanup is allowed only for a just-uploaded object that has not yet
-- become part of the authoritative KLYX verification dossier. Once the server
-- has registered storage_path, deletion must go through the KLYX server API so
-- Storage, document metadata and verification status change together.
create or replace function public.klyx_can_cleanup_provider_verification_object(
  p_name text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.klyx_owns_provider_verification_path(p_name)
    and not exists (
      select 1
      from public.provider_verification_documents as document
      where document.storage_path = p_name
    );
$$;

revoke all on function public.klyx_can_cleanup_provider_verification_object(text)
  from public, anon;
grant execute on function public.klyx_can_cleanup_provider_verification_object(text)
  to authenticated, service_role;

comment on function public.klyx_can_cleanup_provider_verification_object(text) is
  'Allows authenticated cleanup only for an owned provider verification object that is not registered in the KLYX verification dossier.';

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
  and public.klyx_owns_provider_verification_path(name)
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
    and public.klyx_owns_provider_verification_path(name)
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
  )
);

-- SELECT is needed for direct authenticated upload/read behavior and the
-- browser's failed-registration cleanup. The bucket remains private, and only
-- the uploader's owned provider-profile folder is visible to that user.
create policy klyx_provider_verification_select
on storage.objects
as permissive
for select
to authenticated
using (
  bucket_id = 'provider-verification'
  and owner_id = (select auth.uid()::text)
  and public.klyx_owns_provider_verification_path(name)
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
    and public.klyx_owns_provider_verification_path(name)
  )
);

-- DELETE remains available only as cleanup for an upload that the server has
-- not registered. Registered dossier objects cannot be removed directly from
-- a modified browser; the service-role-backed KLYX DELETE API is authoritative.
create policy klyx_provider_verification_delete
on storage.objects
as permissive
for delete
to authenticated
using (
  bucket_id = 'provider-verification'
  and owner_id = (select auth.uid()::text)
  and public.klyx_can_cleanup_provider_verification_object(name)
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
    and public.klyx_can_cleanup_provider_verification_object(name)
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
