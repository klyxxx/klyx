-- ============================================================
-- KLYX 12B.12P PROVIDER DOCUMENT TABLE PRIVILEGE HARDENING
--
-- provider_documents stores private identity/address/insurance/company
-- document metadata and storage paths. Provider Studio already sends every
-- document read/upload/delete through /api/provider/studio, where KLYX
-- authenticates the active provider and uses service_role via supabaseAdmin.
-- The raw table therefore must not remain a browser/PostgREST surface.
--
-- KLYX_PROVIDER_DOCUMENT_TABLE_PRIVILEGES_12B_12P
-- ============================================================

begin;

revoke all privileges on table public.provider_documents
  from public, anon, authenticated;

grant all privileges on table public.provider_documents
  to service_role;

-- Existing RLS remains defense-in-depth. Provider Studio document access is
-- mediated by the authenticated KLYX server API; the provider-assets Storage
-- bucket is a separate policy surface and is not modified by this migration.

commit;
