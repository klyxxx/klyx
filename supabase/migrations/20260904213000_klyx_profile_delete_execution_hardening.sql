-- KLYX profile deletion execution hardening
--
-- A profile is a role-scoped identity (client OR provider) owned by one
-- authenticated auth user. Deleting one profile must never imply deleting
-- sibling profiles that share the same owner_user_id.
--
-- The canonical klyx_delete_profile(uuid) implementation already authorizes
-- through auth.uid() and targets a single p_profile_id. This migration narrows
-- who may invoke that SECURITY DEFINER function: anonymous callers have no
-- legitimate deletion flow.

revoke all on function public.klyx_delete_profile(uuid) from public;
revoke all on function public.klyx_delete_profile(uuid) from anon;
grant execute on function public.klyx_delete_profile(uuid) to authenticated;
grant execute on function public.klyx_delete_profile(uuid) to service_role;

comment on function public.klyx_delete_profile(uuid) is
  'Deletes exactly one authenticated user-owned KLYX profile. Sibling client/provider profiles sharing owner_user_id must remain intact.';
