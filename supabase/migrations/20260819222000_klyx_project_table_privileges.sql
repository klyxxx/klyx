-- KLYX_PROJECT_TABLE_HARDENING_12B_12Y
-- Project planning persists private goals, locations, dates, budgets and
-- generated service plans. The current product boundary is the authenticated
-- /api/projects/plan route, which writes both tables with supabaseAdmin.
-- Keep the raw persistence layer server-only so future browser code cannot
-- bypass the route's authentication and account-type checks.

begin;

revoke all privileges on table public.projects
  from public, anon, authenticated;
revoke all privileges on table public.project_services
  from public, anon, authenticated;

drop policy if exists "klyx_projects_all"
  on public.projects;
drop policy if exists "klyx_project_services_all"
  on public.project_services;

grant all privileges on table public.projects
  to service_role;
grant all privileges on table public.project_services
  to service_role;

commit;
