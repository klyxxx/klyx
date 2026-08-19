-- KLYX_PROVIDER_SERVICE_WRITE_BOUNDARY_12B_13E
-- Provider service configuration is written by Provider Studio / server RPCs.
-- Browser roles keep SELECT only; RLS from 12B.13D remains the read boundary.

begin;

revoke all privileges on table public.user_services
  from public, anon, authenticated;
grant select on table public.user_services
  to anon, authenticated;
grant all privileges on table public.user_services
  to service_role;

revoke all privileges on table public.service_profiles
  from public, anon, authenticated;
grant select on table public.service_profiles
  to anon, authenticated;
grant all privileges on table public.service_profiles
  to service_role;

-- Direct browser mutations are obsolete. Keeping these policies after removing
-- table write grants would make a future accidental grant silently dangerous.
drop policy if exists "klyx_user_services_delete"
  on public.user_services;
drop policy if exists "klyx_user_services_insert"
  on public.user_services;
drop policy if exists "klyx_user_services_update"
  on public.user_services;

drop policy if exists "klyx_service_profiles_delete"
  on public.service_profiles;
drop policy if exists "klyx_service_profiles_insert"
  on public.service_profiles;
drop policy if exists "klyx_service_profiles_update"
  on public.service_profiles;

-- Keep the authenticated/public SELECT policies created by 12B.13D.

commit;
