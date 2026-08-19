-- ============================================================
-- KLYX 12B.12K CLIENT MEMORY TABLE PRIVILEGE HARDENING
--
-- Personal memory and agent planning records may contain household,
-- children, access, scheduling and request details. KLYX already exposes
-- authenticated server APIs for this data, so it must not remain a direct
-- PostgREST/browser table surface.
--
-- KLYX_CLIENT_MEMORY_TABLE_PRIVILEGES_12B_12K
-- ============================================================

begin;

revoke all privileges on table public.user_preferences
  from public, anon, authenticated;
revoke all privileges on table public.client_memory_profiles
  from public, anon, authenticated;
revoke all privileges on table public.user_memory_events
  from public, anon, authenticated;
revoke all privileges on table public.client_agent_plans
  from public, anon, authenticated;

grant all privileges on table public.user_preferences
  to service_role;
grant all privileges on table public.client_memory_profiles
  to service_role;
grant all privileges on table public.user_memory_events
  to service_role;
grant all privileges on table public.client_agent_plans
  to service_role;

-- Existing RLS remains defense-in-depth. Normal user access goes through
-- /api/memory/* and /api/agent/plans, which authenticate the active profile
-- and use service_role only after ownership/account-type checks.

commit;
