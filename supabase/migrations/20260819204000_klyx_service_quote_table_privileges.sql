-- ============================================================
-- KLYX 12B.12R SERVICE QUOTE TABLE PRIVILEGE HARDENING
--
-- service_quotes contains private client/provider request details, pricing,
-- provider messages and quote lifecycle state. Current KLYX quote reads and
-- mutations are mediated by authenticated server APIs using service_role via
-- supabaseAdmin, including the accepted-quote booking handoff. The raw table
-- therefore must not remain a direct browser/PostgREST surface.
--
-- KLYX_SERVICE_QUOTE_TABLE_PRIVILEGES_12B_12R
-- ============================================================

begin;

revoke all privileges on table public.service_quotes
  from public, anon, authenticated;

grant all privileges on table public.service_quotes
  to service_role;

-- Existing client/provider RLS remains defense-in-depth. Normal quote access
-- goes through /api/quotes, /api/quotes/[id] and server-side booking creation.

commit;
