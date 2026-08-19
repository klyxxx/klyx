-- ============================================================
-- KLYX 12B.12E AUTHENTICATED PROFILE PRIVACY + WRITE INTEGRITY
--
-- Goals:
-- - authenticated users must never read another visible profile's
--   phone verification or Stripe account state directly;
-- - direct profile writes must not be able to change ownership,
--   account role, active mode, phone verification or Stripe state;
-- - anonymous/authenticated roles keep no residual table-wide rights
--   such as TRUNCATE, REFERENCES or TRIGGER from the old GRANT ALL;
-- - profile creation/deletion continue through the guarded KLYX RPCs.
--
-- KLYX_AUTHENTICATED_PROFILE_PRIVACY_12B_12E
-- ============================================================

begin;

-- ============================================================
-- 1. FAIL CLOSED FROM THE HISTORICAL GRANT ALL
-- ============================================================
--
-- PostgreSQL GRANT ALL on a table includes more than normal CRUD.
-- Remove every direct table privilege from the public application roles
-- before adding back the minimum explicit read/write surface below.
-- ============================================================

revoke all privileges on table public.profiles from anon;
revoke all privileges on table public.profiles from authenticated;

-- ============================================================
-- 2. ANONYMOUS READ SURFACE
-- ============================================================
--
-- Keep the public-provider fields established by KLYX 12B.12C.
-- RLS still limits these rows to published provider profiles.
-- ============================================================

grant select (
  id,
  first_name,
  last_name,
  city,
  avatar_url,
  account_type
) on table public.profiles to anon;

-- ============================================================
-- 3. AUTHENTICATED READ SURFACE
-- ============================================================
--
-- RLS limits rows, but it does not hide columns. Published providers
-- are visible to authenticated users, so phone and Stripe state must
-- never be part of the direct authenticated column grant.
-- ============================================================

grant select (
  id,
  full_name,
  first_name,
  last_name,
  age,
  city,
  created_at,
  updated_at,
  current_mode,
  account_type,
  owner_user_id,
  avatar_url,
  country_code,
  currency_code
) on table public.profiles to authenticated;

-- Intentionally excluded from authenticated direct SELECT:
-- - phone_number
-- - phone_verified_at
-- - phone_visibility
-- - stripe_account_id
-- - stripe_onboarding_complete
-- - stripe_charges_enabled
-- - stripe_payouts_enabled
--
-- Those values are served only by profile-scoped/server-side KLYX APIs.

-- ============================================================
-- 4. AUTHENTICATED WRITE SURFACE
-- ============================================================
--
-- Creation/deletion are performed by the guarded
-- klyx_create_profile / klyx_delete_profile SECURITY DEFINER RPCs.
-- Direct UPDATE is limited to ordinary editable identity/location
-- fields used by the existing authenticated profile-management route.
-- ============================================================

grant update (
  full_name,
  first_name,
  last_name,
  age,
  city,
  updated_at,
  avatar_url,
  country_code,
  currency_code
) on table public.profiles to authenticated;

-- Protected from authenticated direct INSERT/DELETE/TRUNCATE and from
-- authenticated direct UPDATE:
-- - id / owner_user_id
-- - account_type / current_mode
-- - phone_number / phone_verified_at / phone_visibility
-- - stripe_account_id
-- - stripe_onboarding_complete
-- - stripe_charges_enabled
-- - stripe_payouts_enabled

commit;

-- ============================================================
-- VERIFICATION
-- ============================================================

select
  grantee,
  privilege_type,
  column_name
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'profiles'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type, column_name;
