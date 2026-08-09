-- KLYX 12.5 - SECURITY GATE
-- Audit NON destructif de la securite RLS.
-- Cette migration ne modifie aucune policy existante.

create or replace function public.klyx_security_audit()
returns table (
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
      'notifications'
    )
  group by
    c.relname,
    c.relrowsecurity
  order by c.relname;
$$;

revoke all on function public.klyx_security_audit() from public;
revoke all on function public.klyx_security_audit() from anon;
revoke all on function public.klyx_security_audit() from authenticated;
grant execute on function public.klyx_security_audit() to service_role;
