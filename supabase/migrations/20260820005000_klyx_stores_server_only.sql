-- KLYX_STORES_SERVER_ONLY_12B_13J
-- The legacy store surface is not part of the active KLYX product flow.
-- /create-store only redirects to the supported account/provider experience.
-- Keep the table available to trusted server/admin workflows only.

begin;

revoke all privileges on table public.stores
  from public, anon, authenticated;

grant all privileges on table public.stores
  to service_role;

-- The historical browser policy allowed the active profile owner to perform
-- every table operation. No supported KLYX flow uses direct store access now,
-- so fail closed at RLS as well as at the grant layer.
drop policy if exists "klyx_stores_all"
  on public.stores;

commit;
