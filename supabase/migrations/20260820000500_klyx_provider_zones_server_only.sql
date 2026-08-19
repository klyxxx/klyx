-- KLYX_PROVIDER_ZONES_SERVER_ONLY_12B_13F
-- Provider zone management is fully mediated by /api/provider/zones, whose core
-- authenticates the active provider and uses supabaseAdmin for all table access.

begin;

revoke all privileges on table public.provider_service_zones
  from public, anon, authenticated;

grant all privileges on table public.provider_service_zones
  to service_role;

-- Direct authenticated SELECT is obsolete because the provider UI loads zones
-- through the authenticated server API. Remove the policy as a fail-closed
-- backstop against a future accidental browser grant.
drop policy if exists "Providers read own service zones"
  on public.provider_service_zones;

commit;
