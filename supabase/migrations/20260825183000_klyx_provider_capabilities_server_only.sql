-- ============================================================
-- KLYX PROVIDER CAPABILITIES SERVER-ONLY WRITE BOUNDARY
--
-- Capabilities stay readable by their authenticated owner through RLS,
-- but every product mutation must pass through the KLYX server API.
-- This prevents clients from choosing profile_id, source,
-- canonical_service_id or normalized_label directly.
-- ============================================================

begin;

drop policy if exists "Providers create own capabilities"
  on public.provider_capabilities;
drop policy if exists "Providers update own capabilities"
  on public.provider_capabilities;
drop policy if exists "Providers delete own capabilities"
  on public.provider_capabilities;

revoke insert, update, delete
  on table public.provider_capabilities
  from authenticated;

grant select
  on table public.provider_capabilities
  to authenticated;

grant all
  on table public.provider_capabilities
  to service_role;

comment on table public.provider_capabilities is
  'Compétences/capacités libres déclarées par un prestataire. Lecture propriétaire via RLS; mutations produit uniquement via API serveur KLYX.';

commit;
