-- KLYX provider-verification Storage boundary.
--
-- Provider verification documents are uploaded directly from authenticated
-- browsers to Supabase Storage before their metadata is registered through the
-- KLYX API. The bucket and object policies therefore have to be authoritative
-- at Storage/PostgreSQL level; an application-only guard would be bypassable.

begin;

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
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Resolve the profile id and document category from
-- <provider-profile-id>/<document-type>/<filename> without unsafe casts.
create or replace function public.klyx_owns_provider_verification_path(
  p_object_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_folders text[];
  v_profile_id uuid;
begin
  if auth.uid() is null or p_object_name is null then
    return false;
  end if;

  v_folders := storage.foldername(p_object_name);

  if coalesce(array_length(v_folders, 1), 0) <> 2 then
    return false;
  end if;

  if v_folders[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  if v_folders[2] not in (
    'identity',
    'address',
    'business',
    'insurance',
    'professional_certificate'
  ) then
    return false;
  end if;

  v_profile_id := v_folders[1]::uuid;

  return exists (
    select 1
    from public.profiles as profile
    where profile.id = v_profile_id
      and profile.owner_user_id = auth.uid()
      and profile.account_type = 'provider'
  );
end;
$$;

revoke all on function public.klyx_owns_provider_verification_path(text)
  from public;
grant execute on function public.klyx_owns_provider_verification_path(text)
  to anon, authenticated, service_role;

-- KLYX-owned permissive policies make a fresh project usable. The restrictive
-- policies below are equally important: PostgreSQL ORs permissive policies, so
-- an old broad dashboard policy must not be able to widen this sensitive bucket.
drop policy if exists klyx_provider_verification_select
  on storage.objects;
drop policy if exists klyx_provider_verification_insert
  on storage.objects;
drop policy if exists klyx_provider_verification_delete
  on storage.objects;
drop policy if exists klyx_provider_verification_select_guard
  on storage.objects;
drop policy if exists klyx_provider_verification_insert_guard
  on storage.objects;
drop policy if exists klyx_provider_verification_delete_guard
  on storage.objects;
drop policy if exists klyx_provider_verification_update_guard
  on storage.objects;

create policy klyx_provider_verification_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'provider-verification'
  and public.klyx_owns_provider_verification_path(name)
);

create policy klyx_provider_verification_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'provider-verification'
  and public.klyx_owns_provider_verification_path(name)
);

create policy klyx_provider_verification_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'provider-verification'
  and public.klyx_owns_provider_verification_path(name)
);

create policy klyx_provider_verification_select_guard
on storage.objects
as restrictive
for select
to public
using (
  bucket_id <> 'provider-verification'
  or public.klyx_owns_provider_verification_path(name)
);

create policy klyx_provider_verification_insert_guard
on storage.objects
as restrictive
for insert
to public
with check (
  bucket_id <> 'provider-verification'
  or public.klyx_owns_provider_verification_path(name)
);

create policy klyx_provider_verification_delete_guard
on storage.objects
as restrictive
for delete
to public
using (
  bucket_id <> 'provider-verification'
  or public.klyx_owns_provider_verification_path(name)
);

-- KLYX uses upload(..., { upsert: false }) and immutable verification objects.
-- Explicitly block UPDATE/move/upsert in this bucket even if a legacy broad
-- permissive Storage policy still exists.
create policy klyx_provider_verification_update_guard
on storage.objects
as restrictive
for update
to public
using (bucket_id <> 'provider-verification')
with check (bucket_id <> 'provider-verification');

comment on function public.klyx_owns_provider_verification_path(text) is
  'Returns true only when the authenticated account owns the provider profile encoded in a valid provider-verification object path.';

commit;
