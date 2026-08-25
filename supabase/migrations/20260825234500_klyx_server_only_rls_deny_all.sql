-- ============================================================
-- KLYX SERVER-ONLY RLS DENY-ALL BACKSTOPS
--
-- These tables are intentionally not exposed to browser roles. Their direct
-- privileges remain revoked, and explicit deny-all RLS policies add a second
-- fail-closed layer in case a future migration accidentally restores a grant.
-- The policies also let the Founder RLS audit distinguish "closed on purpose"
-- from "RLS enabled but left without any policy".
-- ============================================================

begin;

alter table public.notifications enable row level security;
revoke all privileges on table public.notifications
  from public, anon, authenticated;
grant all privileges on table public.notifications
  to service_role;
drop policy if exists "klyx_server_only_deny_all"
  on public.notifications;
create policy "klyx_server_only_deny_all"
  on public.notifications
  for all
  to anon, authenticated
  using (false)
  with check (false);

alter table public.provider_service_zones enable row level security;
revoke all privileges on table public.provider_service_zones
  from public, anon, authenticated;
grant all privileges on table public.provider_service_zones
  to service_role;
drop policy if exists "klyx_server_only_deny_all"
  on public.provider_service_zones;
create policy "klyx_server_only_deny_all"
  on public.provider_service_zones
  for all
  to anon, authenticated
  using (false)
  with check (false);

alter table public.reviews enable row level security;
revoke all privileges on table public.reviews
  from public, anon, authenticated;
grant all privileges on table public.reviews
  to service_role;
drop policy if exists "klyx_server_only_deny_all"
  on public.reviews;
create policy "klyx_server_only_deny_all"
  on public.reviews
  for all
  to anon, authenticated
  using (false)
  with check (false);

commit;
