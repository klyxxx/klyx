-- ============================================================
-- KLYX 12B.13Q USER PREFERENCES SERVER BOUNDARY
--
-- user_preferences stores private client defaults, household context,
-- scheduling notes and AI-memory controls. Current KLYX reads and writes
-- this table only through authenticated server APIs using supabaseAdmin.
--
-- KLYX_USER_PREFERENCES_SERVER_ONLY_12B_13Q
-- ============================================================

begin;

revoke all privileges on table public.user_preferences
  from public, anon, authenticated;

-- Remove the historical direct-browser RLS policy as well as the grants so a
-- future broad table grant cannot silently restore direct access.
drop policy if exists "klyx_user_preferences_all"
  on public.user_preferences;

grant all privileges on table public.user_preferences
  to service_role;

commit;
