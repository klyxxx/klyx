-- ============================================================
-- KLYX 12B.12Q PROVIDER ASSISTANT DRAFT PRIVILEGE HARDENING
--
-- provider_assistant_drafts stores private provider AI drafts, including
-- availability plans, client replies and quote payloads. The provider UI
-- already reads, creates and applies/discards drafts through
-- /api/provider/assistant, where KLYX authenticates the active provider and
-- uses service_role via supabaseAdmin. The raw table must therefore not remain
-- a direct browser/PostgREST surface.
--
-- KLYX_PROVIDER_ASSISTANT_DRAFT_PRIVILEGES_12B_12Q
-- ============================================================

begin;

revoke all privileges on table public.provider_assistant_drafts
  from public, anon, authenticated;

grant all privileges on table public.provider_assistant_drafts
  to service_role;

-- Existing RLS remains defense-in-depth. Normal provider assistant access is
-- mediated by the authenticated KLYX server API with profile ownership checks.

commit;
