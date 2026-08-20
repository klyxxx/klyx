-- KLYX_PROFILE_RPC_AUTHENTICATED_ONLY_12B_13K
-- Profile creation/deletion depend on the caller's auth.uid(). Anonymous callers
-- cannot satisfy that identity contract and must not receive EXECUTE at all.

begin;

revoke all on function public.klyx_create_profile(text, text, text, text, uuid)
  from public, anon;
grant execute on function public.klyx_create_profile(text, text, text, text, uuid)
  to authenticated, service_role;

revoke all on function public.klyx_delete_profile(uuid)
  from public, anon;
grant execute on function public.klyx_delete_profile(uuid)
  to authenticated, service_role;

commit;
