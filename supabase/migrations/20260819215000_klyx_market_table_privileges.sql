-- ============================================================
-- KLYX 12B.12W MARKET TABLE PRIVILEGE HARDENING
--
-- market_service_requests contains client descriptions, location/schedule,
-- budget and matching state. market_service_offers contains provider pricing,
-- messages and offer lifecycle state. Current KLYX client/provider flows read
-- and mutate these records only through authenticated server APIs using
-- service_role via supabaseAdmin.
--
-- KLYX_MARKET_TABLE_PRIVILEGES_12B_12W
-- ============================================================

begin;

revoke all privileges on table public.market_service_requests
  from public, anon, authenticated;
revoke all privileges on table public.market_service_offers
  from public, anon, authenticated;

-- These historical browser SELECT policies are obsolete now that marketplace
-- access is mediated by the server. Removing them prevents a future accidental
-- table grant from exposing raw marketplace records again. In particular, the
-- old provider policy allowed any provider account to read every open request,
-- while the server API applies service compatibility and eligibility filtering.
drop policy if exists "Clients read own market requests"
  on public.market_service_requests;
drop policy if exists "Providers read open market requests"
  on public.market_service_requests;
drop policy if exists "Clients read offers on own requests"
  on public.market_service_offers;
drop policy if exists "Providers read own market offers"
  on public.market_service_offers;

grant all privileges on table public.market_service_requests
  to service_role;
grant all privileges on table public.market_service_offers
  to service_role;

-- RLS remains enabled as defense-in-depth for any future non-bypass role.
-- Normal marketplace access stays behind /api/market/* and /api/provider/jobs.

commit;
