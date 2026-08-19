-- ============================================================
-- KLYX 12B.12E AUTHENTICATED PROFILE PRIVACY + WRITE INTEGRITY
--
-- Goals:
-- - authenticated users must never read another visible profile's
--   phone verification or Stripe account state directly;
-- - direct profile writes must not be able to change ownership,
--   account role, active mode, phone verification or Stripe state;
-- - profile creation/deletion continue through the guarded KLYX RPCs.
--
-- KLYX_AUTHENTICATED_PROFILE_PRIVACY_12B_12E
-- ============================================================

begin;

-- ============================================================
-- 1. AUTHENTICATED READ SURFACE
-- ============================================================
--
-- The historical baseline granted SELECT on the whole profiles table.
-- RLS limits rows, but it does not hide columns. Because published
-- providers are visible to authenticated users, table-wide SELECT also
-- exposed private phone/Stripe fields for those rows.
--
-- Revoke the table-wide privilege, then explicitly allow only the
-- non-secret profile fields needed by authenticated application flows.
-- ============================================================

revoke select on table public.profiles from authenticated;

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
-- 2. AUTHENTICATED WRITE SURFACE
-- ============================================================
--
-- The baseline GRANT ALL allowed a profile owner to submit arbitrary
-- direct updates to every profiles column. RLS proves row ownership but
-- cannot stop an owner from changing protected columns on that row.
--
-- Remove broad DML. Creation/deletion are performed by the guarded
-- klyx_create_profile / klyx_delete_profile RPCs. Direct UPDATE is
-- limited to ordinary editable identity/location fields used by the
-- existing authenticated profile-management route.
-- ============================================================

revoke insert, update, delete on table public.profiles from authenticated;

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

-- Protected from authenticated direct UPDATE:
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
  and grantee = 'authenticated'
order by privilege_type, column_name;
