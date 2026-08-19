-- KLYX_SERVICES_SELECT_ONLY_12B_13H
-- The service catalog is public/readable, but catalog writes are owned by
-- trusted server/admin workflows.

begin;

revoke all privileges on table public.services
  from public, anon, authenticated;

grant select on table public.services
  to anon, authenticated;

grant all privileges on table public.services
  to service_role;

-- Keep the existing klyx_services_select RLS policy. There are no direct
-- browser mutation policies to preserve.

commit;
