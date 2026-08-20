-- KLYX_OWNERSHIP_HELPERS_AUTHENTICATED_ONLY_12B_13O
-- Legacy ownership helpers depend on auth.uid() and exist for authenticated RLS
-- and authenticated Storage checks. Public provider reads must not depend on
-- those helpers, so split the two remaining mixed provider policies first and
-- then remove direct anonymous execution from the ownership helper family.

begin;

-- Preserve the exact provider-profile visibility contract without evaluating
-- an ownership helper for anonymous callers.
drop policy if exists "klyx_provider_profiles_select"
  on public.provider_profiles;
drop policy if exists "klyx_provider_profiles_public_select"
  on public.provider_profiles;
drop policy if exists "klyx_provider_profiles_authenticated_select"
  on public.provider_profiles;

create policy "klyx_provider_profiles_public_select"
  on public.provider_profiles
  for select
  to anon
  using (is_published = true);

create policy "klyx_provider_profiles_authenticated_select"
  on public.provider_profiles
  for select
  to authenticated
  using (
    is_published = true
    or public.klyx_owns_profile(profile_id)
  );

-- Preserve published gallery visibility for anonymous users and owner draft
-- visibility for authenticated providers without a mixed-role policy.
drop policy if exists "klyx_provider_gallery_select"
  on public.provider_gallery;
drop policy if exists "klyx_provider_gallery_public_select"
  on public.provider_gallery;
drop policy if exists "klyx_provider_gallery_authenticated_select"
  on public.provider_gallery;

create policy "klyx_provider_gallery_public_select"
  on public.provider_gallery
  for select
  to anon
  using (
    exists (
      select 1
      from public.provider_profiles as provider_profile
      where provider_profile.profile_id = provider_gallery.profile_id
        and provider_profile.is_published = true
    )
  );

create policy "klyx_provider_gallery_authenticated_select"
  on public.provider_gallery
  for select
  to authenticated
  using (
    public.klyx_owns_profile(profile_id)
    or exists (
      select 1
      from public.provider_profiles as provider_profile
      where provider_profile.profile_id = provider_gallery.profile_id
        and provider_profile.is_published = true
    )
  );

-- Authorization helpers are authenticated infrastructure, not public RPCs.
revoke all on function public.klyx_owns_profile(uuid)
  from public, anon;
grant execute on function public.klyx_owns_profile(uuid)
  to authenticated, service_role;

revoke all on function public.klyx_owns_booking(uuid)
  from public, anon;
grant execute on function public.klyx_owns_booking(uuid)
  to authenticated, service_role;

revoke all on function public.klyx_owns_conversation(uuid)
  from public, anon;
grant execute on function public.klyx_owns_conversation(uuid)
  to authenticated, service_role;

revoke all on function public.klyx_owns_project(uuid)
  from public, anon;
grant execute on function public.klyx_owns_project(uuid)
  to authenticated, service_role;

revoke all on function public.klyx_owns_user_service(uuid)
  from public, anon;
grant execute on function public.klyx_owns_user_service(uuid)
  to authenticated, service_role;

revoke all on function public.klyx_shares_booking_with_profile(uuid)
  from public, anon;
grant execute on function public.klyx_shares_booking_with_profile(uuid)
  to authenticated, service_role;

revoke all on function public.klyx_owns_avatar_path(text)
  from public, anon;
grant execute on function public.klyx_owns_avatar_path(text)
  to authenticated, service_role;

commit;
