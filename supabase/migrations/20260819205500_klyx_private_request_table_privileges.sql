-- ============================================================
-- KLYX 12B.12S PRIVATE REQUEST TABLE PRIVILEGE HARDENING
--
-- service_requests stores raw client text, parsed request payloads, budget,
-- schedule and household/service context. photo_service_requests stores
-- private photo metadata, storage paths, user descriptions and analysis
-- payloads. Current KLYX flows access both tables only through authenticated
-- server APIs using service_role via supabaseAdmin.
--
-- KLYX_PRIVATE_REQUEST_TABLE_PRIVILEGES_12B_12S
-- ============================================================

begin;

revoke all privileges on table public.service_requests
  from public, anon, authenticated;
revoke all privileges on table public.photo_service_requests
  from public, anon, authenticated;

-- Remove historical browser policies as well as grants so accidental future
-- table grants do not silently restore direct access to these private records.
drop policy if exists "klyx_service_requests_all"
  on public.service_requests;
drop policy if exists "Clients read own photo requests"
  on public.photo_service_requests;

grant all privileges on table public.service_requests
  to service_role;
grant all privileges on table public.photo_service_requests
  to service_role;

-- The client-service-photos Storage bucket is deliberately not modified here.
-- /request/photo still uploads the image object directly after authentication;
-- the database metadata is then created/deleted through /api/requests/photo.

commit;
