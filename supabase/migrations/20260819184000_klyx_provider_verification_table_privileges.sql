-- ============================================================
-- KLYX 12B.12J PROVIDER VERIFICATION TABLE PRIVILEGE HARDENING
--
-- Provider identity and skill verification metadata is accessed through
-- authenticated KLYX server APIs. Sensitive verification rows and private
-- document metadata must not be a direct PostgREST/browser surface.
--
-- KLYX_PROVIDER_VERIFICATION_TABLE_PRIVILEGES_12B_12J
-- ============================================================

begin;

-- General KYC dossier and private identity/address/professional documents.
revoke all privileges on table public.provider_verifications
  from public, anon, authenticated;
revoke all privileges on table public.provider_verification_documents
  from public, anon, authenticated;

grant all privileges on table public.provider_verifications
  to service_role;
grant all privileges on table public.provider_verification_documents
  to service_role;

-- Per-skill qualification dossiers and their private evidence documents.
revoke all privileges on table public.provider_skill_verifications
  from public, anon, authenticated;
revoke all privileges on table public.provider_skill_documents
  from public, anon, authenticated;

grant all privileges on table public.provider_skill_verifications
  to service_role;
grant all privileges on table public.provider_skill_documents
  to service_role;

-- Existing RLS remains defense-in-depth, but normal KLYX provider pages
-- read/write these records through server APIs after ownership checks.
-- The provider-verification Storage bucket keeps its own separate policies.

commit;
