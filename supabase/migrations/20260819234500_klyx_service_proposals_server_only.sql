-- KLYX_SERVICE_PROPOSALS_SERVER_ONLY_12B_13I
-- Provider and admin proposal workflows are mediated by authenticated server
-- routes. Raw proposal content and admin notes are not a browser table surface.

begin;

revoke all privileges on table public.service_proposals
  from public, anon, authenticated;

grant all privileges on table public.service_proposals
  to service_role;

-- These direct PostgREST policies are obsolete now that both provider and admin
-- proposal workflows execute after server-side authorization.
drop policy if exists "Providers can create own service proposals"
  on public.service_proposals;

drop policy if exists "Providers can read own service proposals"
  on public.service_proposals;

commit;
