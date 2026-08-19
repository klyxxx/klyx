-- ============================================================
-- KLYX 12B.12M DISPUTE TABLE PRIVILEGE HARDENING
--
-- Disputes contain participant allegations, free-text descriptions,
-- moderation decisions and event history. KLYX already authenticates
-- the active profile and accesses these records through server APIs with
-- service_role, so raw dispute records must not remain a direct
-- PostgREST/browser table surface.
--
-- KLYX_DISPUTE_TABLE_PRIVILEGES_12B_12M
-- ============================================================

begin;

revoke all privileges on table public.disputes
  from public, anon, authenticated;
revoke all privileges on table public.dispute_events
  from public, anon, authenticated;

grant all privileges on table public.disputes
  to service_role;
grant all privileges on table public.dispute_events
  to service_role;

-- Existing RLS remains defense-in-depth. Participant dispute access and
-- mutations go through authenticated KLYX server routes using service_role.

commit;
