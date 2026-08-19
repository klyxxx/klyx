-- ============================================================
-- KLYX 12B.12G PROFILE SERVER BOUNDARY
--
-- 12B.12E removed sensitive phone/Stripe columns from direct access,
-- but intentionally retained ordinary direct UPDATE privileges.
-- KLYX now has authenticated server routes for profile identity, avatar,
-- phone and mode changes, so browser-side writes are no longer required.
--
-- KLYX_PROFILE_SERVER_BOUNDARY_12B_12G
-- ============================================================

begin;

-- Fail closed again, overriding the residual authenticated SELECT/UPDATE
-- grants from 12B.12E. No browser session may mutate profiles directly.
revoke all privileges on table public.profiles from authenticated;

-- Authenticated discovery may read only non-sensitive provider-directory
-- fields plus country/currency needed by market-aware discovery. RLS still
-- controls which profile rows are visible.
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

-- No direct INSERT / UPDATE / DELETE is granted back.
-- Rich own-profile reads and all legitimate profile mutations are handled
-- by KLYX server routes with authenticated ownership checks + service_role.

commit;
