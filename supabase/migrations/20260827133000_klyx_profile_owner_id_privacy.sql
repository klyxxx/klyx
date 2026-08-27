-- KLYX full audit: profile ownership privacy
-- Browser sessions do not need owner_user_id anymore. Multi-profile ownership
-- is resolved server-side through service_role and filtered by auth user id.

begin;

revoke select (owner_user_id) on table public.profiles from authenticated;

commit;

-- Verification: this must return false after the migration.
select has_column_privilege(
  'authenticated',
  'public.profiles',
  'owner_user_id',
  'SELECT'
) as authenticated_can_read_owner_user_id;
