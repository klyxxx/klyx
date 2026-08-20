-- ============================================================
-- KLYX 12B.13Q USER PREFERENCES POLICY LOCKDOWN
--
-- 12B.12K already removed public/anon/authenticated table privileges from
-- user_preferences and kept service_role as the server database boundary.
-- The historical authenticated RLS policy is therefore dormant, but leaving
-- it in place could silently restore direct browser access if a broad table
-- grant is introduced later. Make the boundary fail closed by removing it.
--
-- KLYX_USER_PREFERENCES_POLICY_LOCKDOWN_12B_13Q
-- ============================================================

begin;

drop policy if exists "klyx_user_preferences_all"
  on public.user_preferences;

commit;
