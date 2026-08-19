-- ============================================================
-- KLYX 12B.12F DEFAULT DATABASE PRIVILEGES HARDENING
--
-- The canonical baseline historically granted ALL privileges on every
-- future postgres-owned table and sequence in public to anon and
-- authenticated. New objects must instead start private and be opened
-- deliberately through explicit grants + RLS-reviewed migrations.
--
-- KLYX_DEFAULT_DB_PRIVILEGES_HARDENING_12B_12F
-- ============================================================

begin;

-- Future tables: fail closed for application roles.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;

-- Future sequences: fail closed for application roles.
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;

-- Server-side service-role operations keep their explicit administrative
-- default access. postgres ownership is unchanged.
alter default privileges for role postgres in schema public
  grant all on tables to service_role;

alter default privileges for role postgres in schema public
  grant all on sequences to service_role;

commit;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- Inspect the resulting default ACLs. Application roles should not have
-- default table/sequence grants after this migration.

select
  defaclrole::regrole as owner_role,
  defaclnamespace::regnamespace as schema_name,
  defaclobjtype,
  defaclacl
from pg_default_acl
where defaclrole = 'postgres'::regrole
order by defaclnamespace, defaclobjtype;
