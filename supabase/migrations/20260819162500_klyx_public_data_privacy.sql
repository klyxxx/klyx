-- ============================================================
-- KLYX 12B.12C PUBLIC DATA PRIVACY HARDENING
--
-- Goals:
-- - never expose private provider profile columns to anon;
-- - unpublished providers must not be enumerable through profiles,
--   services, service profiles or availability;
-- - raw review rows (booking_id / author_id / target_id) are not a
--   public database surface; public reviews go through the KLYX API.
--
-- KLYX_PUBLIC_DATA_PRIVACY_12B_12C
-- ============================================================

begin;

-- ============================================================
-- 1. PROFILES: published providers only for public row access
-- ============================================================

drop policy if exists "klyx_profiles_select" on public.profiles;
drop policy if exists "klyx_profiles_authenticated_select" on public.profiles;
drop policy if exists "klyx_profiles_public_select" on public.profiles;

create policy "klyx_profiles_authenticated_select"
on public.profiles
for select
to authenticated
using (
  owner_user_id = auth.uid()
  or public.klyx_shares_booking_with_profile(id)
  or (
    account_type = 'provider'
    and exists (
      select 1
      from public.provider_profiles as provider_profile
      where provider_profile.profile_id = profiles.id
        and provider_profile.is_published = true
    )
  )
);

create policy "klyx_profiles_public_select"
on public.profiles
for select
to anon
using (
  account_type = 'provider'
  and exists (
    select 1
    from public.provider_profiles as provider_profile
    where provider_profile.profile_id = profiles.id
      and provider_profile.is_published = true
  )
);

-- RLS filters rows, not columns. Remove table-wide anonymous SELECT
-- and grant only fields needed by the public provider directory.
revoke select on table public.profiles from anon;

grant select (
  id,
  first_name,
  last_name,
  city,
  avatar_url,
  account_type
) on table public.profiles to anon;

-- Explicitly document fields that must never become anonymous SELECT
-- columns without a new privacy review:
-- owner_user_id, phone_number, phone_verified_at, phone_visibility,
-- stripe_account_id, stripe_onboarding_complete,
-- stripe_charges_enabled, stripe_payouts_enabled, current_mode.

-- ============================================================
-- 2. RAW REVIEWS: participants only; public rendering uses API
-- ============================================================

drop policy if exists "klyx_reviews_select" on public.reviews;
drop policy if exists "klyx_reviews_authenticated_select" on public.reviews;

create policy "klyx_reviews_authenticated_select"
on public.reviews
for select
to authenticated
using (
  public.klyx_owns_profile(author_id)
  or public.klyx_owns_profile(target_id)
  or public.klyx_owns_booking(booking_id)
);

revoke select on table public.reviews from anon;

-- ============================================================
-- 3. USER SERVICES: public only when provider is published
-- ============================================================

drop policy if exists "klyx_user_services_select" on public.user_services;
drop policy if exists "klyx_user_services_authenticated_select" on public.user_services;
drop policy if exists "klyx_user_services_public_select" on public.user_services;

create policy "klyx_user_services_authenticated_select"
on public.user_services
for select
to authenticated
using (
  public.klyx_owns_profile(user_id)
  or (
    active = true
    and provider_enabled = true
    and exists (
      select 1
      from public.provider_profiles as provider_profile
      where provider_profile.profile_id = user_services.user_id
        and provider_profile.is_published = true
    )
  )
);

create policy "klyx_user_services_public_select"
on public.user_services
for select
to anon
using (
  active = true
  and provider_enabled = true
  and exists (
    select 1
    from public.provider_profiles as provider_profile
    where provider_profile.profile_id = user_services.user_id
      and provider_profile.is_published = true
  )
);

-- ============================================================
-- 4. SERVICE PROFILES: same publication boundary
-- ============================================================

drop policy if exists "klyx_service_profiles_select" on public.service_profiles;
drop policy if exists "klyx_service_profiles_authenticated_select" on public.service_profiles;
drop policy if exists "klyx_service_profiles_public_select" on public.service_profiles;

create policy "klyx_service_profiles_authenticated_select"
on public.service_profiles
for select
to authenticated
using (
  public.klyx_owns_user_service(user_service_id)
  or exists (
    select 1
    from public.user_services as user_service
    join public.provider_profiles as provider_profile
      on provider_profile.profile_id = user_service.user_id
    where user_service.id = service_profiles.user_service_id
      and user_service.active = true
      and user_service.provider_enabled = true
      and provider_profile.is_published = true
  )
);

create policy "klyx_service_profiles_public_select"
on public.service_profiles
for select
to anon
using (
  exists (
    select 1
    from public.user_services as user_service
    join public.provider_profiles as provider_profile
      on provider_profile.profile_id = user_service.user_id
    where user_service.id = service_profiles.user_service_id
      and user_service.active = true
      and user_service.provider_enabled = true
      and provider_profile.is_published = true
  )
);

-- ============================================================
-- 5. AVAILABILITY: no schedule enumeration for unpublished providers
-- ============================================================

drop policy if exists "klyx_availability_select" on public.availability_slots;
drop policy if exists "klyx_availability_authenticated_select" on public.availability_slots;
drop policy if exists "klyx_availability_public_select" on public.availability_slots;

create policy "klyx_availability_authenticated_select"
on public.availability_slots
for select
to authenticated
using (
  public.klyx_owns_user_service(user_service_id)
  or (
    is_active = true
    and exists (
      select 1
      from public.user_services as user_service
      join public.provider_profiles as provider_profile
        on provider_profile.profile_id = user_service.user_id
      where user_service.id = availability_slots.user_service_id
        and user_service.active = true
        and user_service.provider_enabled = true
        and provider_profile.is_published = true
    )
  )
);

create policy "klyx_availability_public_select"
on public.availability_slots
for select
to anon
using (
  is_active = true
  and exists (
    select 1
    from public.user_services as user_service
    join public.provider_profiles as provider_profile
      on provider_profile.profile_id = user_service.user_id
    where user_service.id = availability_slots.user_service_id
      and user_service.active = true
      and user_service.provider_enabled = true
      and provider_profile.is_published = true
  )
);

commit;
