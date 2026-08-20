-- KLYX_STORES_SERVER_ONLY_12B_13J
-- The legacy store surface is not part of the active KLYX product flow.
-- /create-store only redirects to the supported account/provider experience.
-- Keep the table available to trusted server/admin workflows only.

begin;

revoke all privileges on table public.stores
  from public, anon, authenticated;

grant all privileges on table public.stores
  to service_role;

-- Historical direct browser policies are obsolete and exposed contact data
-- such as phone/email through the public SELECT policy.
drop policy if exists "stores delete own"
  on public.stores;
drop policy if exists "stores insert own"
  on public.stores;
drop policy if exists "stores update own"
  on public.stores;
drop policy if exists "stores select public"
  on public.stores;

commit;
