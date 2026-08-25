-- ============================================================
-- KLYX SERVER-ONLY RLS DENY-ALL BACKSTOPS
--
-- These tables are intentionally not exposed to browser roles. Their direct
-- privileges remain revoked, and explicit deny-all RLS policies add a second
-- fail-closed layer in case a future migration accidentally restores a grant.
-- The Founder audit also includes user_notifications, the canonical KLYX
-- notification store, while the historical notifications table stays locked.
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

create or replace function public.klyx_security_audit()
returns table(
  table_name text,
  rls_enabled boolean,
  policy_count bigint
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select
    c.relname::text as table_name,
    c.relrowsecurity as rls_enabled,
    count(p.policyname)::bigint as policy_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n
    on n.oid = c.relnamespace
  left join pg_catalog.pg_policies p
    on p.schemaname = n.nspname
   and p.tablename = c.relname
  where
    n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (
      'profiles',
      'user_services',
      'service_profiles',
      'provider_profiles',
      'provider_service_zones',
      'availability_slots',
      'favorites',
      'bookings',
      'service_quotes',
      'messages',
      'reviews',
      'disputes',
      'notifications',
      'user_notifications'
    )
  group by
    c.relname,
    c.relrowsecurity
  order by c.relname;
$$;

alter function public.klyx_security_audit() owner to postgres;
revoke all on function public.klyx_security_audit()
  from public, anon, authenticated;
grant execute on function public.klyx_security_audit()
  to service_role;

commit;
