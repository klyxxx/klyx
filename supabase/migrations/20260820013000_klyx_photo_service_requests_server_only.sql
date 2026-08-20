-- KLYX_PHOTO_SERVICE_REQUESTS_SERVER_ONLY_12B_13L
-- Client photo files remain an authenticated Storage browser surface, while
-- photo request metadata is created, read, and deleted only by trusted routes.

begin;

revoke all privileges on table public.photo_service_requests
  from public, anon, authenticated;

grant all privileges on table public.photo_service_requests
  to service_role;

-- Direct PostgREST reads are obsolete now that the active photo workflow keeps
-- SQL metadata behind authenticated server-side authorization.
drop policy if exists "Clients read own photo requests"
  on public.photo_service_requests;

commit;
