-- KLYX_PROVIDER_PROFILE_PRIVILEGES_12B_13C
-- Public/provider-detail pages only need the commercial profile fields below.
-- Provider onboarding and every mutation are server/RPC-owned.

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

-- Provider Studio already owns these mutations through supabaseAdmin and
-- first-profile creation is handled by the SECURITY DEFINER profile RPC.
-- Remove obsolete browser mutation policies so a later broad grant cannot
-- silently reopen writes.
drop policy if exists "klyx_provider_profiles_delete"
  on public.provider_profiles;
drop policy if exists "klyx_provider_profiles_insert"
  on public.provider_profiles;
drop policy if exists "klyx_provider_profiles_update"
  on public.provider_profiles;

-- Keep klyx_provider_profiles_select: it exposes only published providers to
-- other users while still allowing an owner to inspect their own draft row.

commit;
