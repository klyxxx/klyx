-- ============================================================
-- KLYX 12B.12L BRAIN CONVERSATION TABLE PRIVILEGE HARDENING
--
-- Brain conversations contain raw user requests, assistant replies and
-- structured payloads. KLYX already authenticates and verifies ownership
-- in /api/brain/* before using service_role, so these records must not be
-- a direct PostgREST/browser table surface.
--
-- KLYX_BRAIN_CONVERSATION_TABLE_PRIVILEGES_12B_12L
-- ============================================================

begin;

revoke all privileges on table public.brain_conversations
  from public, anon, authenticated;
revoke all privileges on table public.brain_messages
  from public, anon, authenticated;

grant all privileges on table public.brain_conversations
  to service_role;
grant all privileges on table public.brain_messages
  to service_role;

-- Existing RLS remains defense-in-depth. Normal conversation access goes
-- through KLYX server APIs after active-profile ownership verification.

commit;
