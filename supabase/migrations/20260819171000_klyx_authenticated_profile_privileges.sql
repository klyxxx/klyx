-- ============================================================
-- KLYX 12B.12E AUTHENTICATED PROFILE PRIVILEGE HARDENING
--
-- RLS controls rows, but table-wide GRANT ALL also exposes every
-- profile column and permits direct writes to server-controlled fields.
-- Keep the browser role least-privileged:
-- - anonymous users retain only the six public provider columns;
-- - authenticated users can read only non-secret profile fields;
-- - authenticated direct updates are limited to user-editable fields;
-- - direct INSERT / DELETE / TRUNCATE / trigger-level privileges vanish;
-- - phone, verification and Stripe fields remain server/API controlled.
--
-- KLYX_AUTHENTICATED_PROFILE_PRIVILEGES_12B_12E
-- ============================================================

begin;

-- Remove the broad privileges inherited from the canonical baseline.
-- This also removes INSERT, DELETE, TRUNCATE, REFERENCES and TRIGGER
-- capabilities that are not required by the KLYX browser session.
revoke all on table public.profiles from anon, authenticated;

-- Public provider directory: keep exactly the already-approved fields
-- from KLYX 12B.12C.
grant select (
  id,
  first_name,
  last_name,
  city,
  avatar_url,
  account_type
) on table public.profiles to anon;

-- Signed-in KLYX clients may need a wider non-secret projection for
-- their own profile/multi-profile UX and published-provider rendering.
-- Deliberately excluded:
--   phone_number, phone_verified_at, phone_visibility,
--   stripe_account_id, stripe_onboarding_complete,
--   stripe_charges_enabled, stripe_payouts_enabled.
grant select (
  id,
  created_at,
  updated_at,
  first_name,
  last_name,
  full_name,
  age,
  city,
  avatar_url,
  current_mode,
  account_type,
  owner_user_id,
  country_code,
  currency_code
) on table public.profiles to authenticated;

-- The existing authenticated UPDATE RLS policy still limits writes to
-- profiles owned by auth.uid(). Column privileges additionally prevent
-- a browser client from forging ownership, role, phone verification or
-- Stripe readiness/account state.
grant update (
  first_name,
  last_name,
  full_name,
  age,
  city,
  avatar_url,
  country_code,
  currency_code,
  updated_at
) on table public.profiles to authenticated;

-- Profile creation/deletion intentionally remain behind the existing
-- SECURITY DEFINER klyx_create_profile / klyx_delete_profile RPCs.
-- Phone and Stripe state remain behind KLYX server APIs using service_role.

commit;
