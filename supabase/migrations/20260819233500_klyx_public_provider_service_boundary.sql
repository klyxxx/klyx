-- KLYX_PUBLIC_PROVIDER_SERVICE_BOUNDARY_12B_13D
-- A provider service is public only when every publication gate is satisfied:
-- published provider profile, active/provider-enabled service, available service
-- profile, and approved provider skill verification.

begin;

create or replace function public.klyx_public_provider_service(
  p_user_service_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_services as user_service
    join public.service_profiles as service_profile
      on service_profile.user_service_id = user_service.id
    join public.provider_profiles as provider_profile
      on provider_profile.profile_id = user_service.user_id
    join public.provider_skill_verifications as verification
      on verification.user_service_id = user_service.id
     and verification.profile_id = user_service.user_id
     and verification.status = 'approved'
    where user_service.id = p_user_service_id
      and user_service.active = true
      and user_service.provider_enabled = true
      and service_profile.available = true
      and provider_profile.is_published = true
  );
$$;

revoke all privileges on function public.klyx_public_provider_service(uuid)
  from public, anon, authenticated;
grant execute on function public.klyx_public_provider_service(uuid)
  to anon, authenticated, service_role;

-- 12B.13A introduced this helper for direct availability SELECT. Delegate it to
-- the canonical public-service predicate so schedule visibility cannot drift
-- from provider/service publication rules again.
create or replace function public.klyx_public_availability_service(
  p_user_service_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.klyx_public_provider_service(p_user_service_id);
$$;

revoke all privileges on function public.klyx_public_availability_service(uuid)
  from public, anon, authenticated;
grant execute on function public.klyx_public_availability_service(uuid)
  to anon, authenticated, service_role;

-- Replace the 12B.12C public/authenticated SELECT policies with the same
-- canonical predicate. Owners retain access to their own draft configuration.
drop policy if exists "klyx_user_services_authenticated_select"
  on public.user_services;
drop policy if exists "klyx_user_services_public_select"
  on public.user_services;

create policy "klyx_user_services_authenticated_select"
  on public.user_services
  for select
  to authenticated
  using (
    public.klyx_owns_profile(user_id)
    or public.klyx_public_provider_service(id)
  );

create policy "klyx_user_services_public_select"
  on public.user_services
  for select
  to anon
  using (
    public.klyx_public_provider_service(id)
  );

drop policy if exists "klyx_service_profiles_authenticated_select"
  on public.service_profiles;
drop policy if exists "klyx_service_profiles_public_select"
  on public.service_profiles;

create policy "klyx_service_profiles_authenticated_select"
  on public.service_profiles
  for select
  to authenticated
  using (
    public.klyx_owns_user_service(user_service_id)
    or public.klyx_public_provider_service(user_service_id)
  );

create policy "klyx_service_profiles_public_select"
  on public.service_profiles
  for select
  to anon
  using (
    public.klyx_public_provider_service(user_service_id)
  );

commit;
