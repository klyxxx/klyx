-- KLYX_PROFILE_HAS_TYPE_AUTHENTICATED_ONLY_12B_13N
-- klyx_profile_has_type is a SECURITY DEFINER authorization helper used by
-- authenticated RLS write policies. Anonymous direct execution bypasses the
-- profiles row boundary and can reveal whether a private profile has a role.

begin;

revoke all on function public.klyx_profile_has_type(uuid, text)
  from public, anon;

grant execute on function public.klyx_profile_has_type(uuid, text)
  to authenticated, service_role;

commit;
