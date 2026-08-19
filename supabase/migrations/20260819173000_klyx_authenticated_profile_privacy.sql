-- ============================================================
-- KLYX 12B.12E AUTHENTICATED PROFILE PRIVACY + INTEGRITY
--
-- The browser/authenticated role must not be able to read or mutate
-- server-managed profile fields directly. Sensitive phone/Stripe/owner
-- data is exposed only through authenticated KLYX server routes.
--
-- KLYX_AUTHENTICATED_PROFILE_PRIVACY_12B_12E
-- ============================================================

begin;

-- The canonical baseline granted ALL on profiles to authenticated.
-- RLS limits rows, but it does not limit columns and therefore does not
-- prevent a profile owner from attempting to overwrite server-managed
-- fields such as stripe_account_id or phone_verified_at directly.
revoke all privileges on table public.profiles from authenticated;

-- Authenticated browser queries retain only the same non-sensitive
-- provider-directory fields that are safe to expose publicly, plus the
-- market snapshot fields used by authenticated discovery experiences.
grant select (
  id,
  first_name,
  last_name,
  city,
  avatar_url,
  account_type,
  country_code,
  currency_code
) on table public.profiles to authenticated;

-- Intentionally NOT granted to authenticated:
-- owner_user_id,
-- phone_number,
-- phone_verified_at,
-- phone_visibility,
-- stripe_account_id,
-- stripe_onboarding_complete,
-- stripe_charges_enabled,
-- stripe_payouts_enabled,
-- current_mode,
-- age,
-- full_name,
-- created_at,
-- updated_at.
--
-- Reads/writes that legitimately need these fields are performed by
-- KLYX server routes after auth/session + active-profile ownership checks.

commit;
