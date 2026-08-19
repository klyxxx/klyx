-- KLYX_PROVIDER_PROFILE_PRIVILEGES_12B_13C
-- Provider profile editing/publishing is server-owned through Provider Studio.
-- Browser roles retain only the columns needed to render a public provider
-- profile or an owner's unpublished profile under the existing SELECT RLS rule.

begin;

revoke all privileges on table public.provider_profiles
  from public, anon, authenticated;

grant select (
  profile_id,
  business_name,
  headline,
  bio,
  years_experience,
  is_published,
  verification_status
) on table public.provider_profiles
  to anon, authenticated;

grant all privileges on table public.provider_profiles
  to service_role;

-- Mutations are obsolete in PostgREST. Provider Studio performs the upsert with
-- supabaseAdmin after validating the active provider profile and publication
-- requirements, so fail closed at RLS as well.
drop policy if exists "klyx_provider_profiles_insert"
  on public.provider_profiles;

drop policy if exists "klyx_provider_profiles_update"
  on public.provider_profiles;

drop policy if exists "klyx_provider_profiles_delete"
  on public.provider_profiles;

-- Keep klyx_provider_profiles_select intact: published profiles remain public,
-- while an authenticated owner may still read their own unpublished profile.

commit;
