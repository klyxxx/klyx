-- KLY-7 / KLYX_PROFILE_TYPE_OWNERSHIP_GUARD
--
-- klyx_profile_has_type is SECURITY DEFINER because RLS policies use it to
-- inspect a profile row without recursively re-entering profiles RLS.
-- Direct authenticated EXECUTE must nevertheless respect profile ownership:
-- knowing another private profile UUID must not reveal whether it is a client
-- or provider profile.
--
-- service_role remains explicitly supported for trusted server-side work.
-- Existing client/provider independence is unchanged: the helper only answers
-- for the authenticated owner's own profiles.

begin;

create or replace function public.klyx_profile_has_type(
  profile_id uuid,
  expected_type text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = profile_id
      and profile.account_type = expected_type
      and (
        auth.role() = 'service_role'
        or (
          auth.uid() is not null
          and profile.owner_user_id = auth.uid()
        )
      )
  );
$$;

-- Keep the helper unavailable to anonymous/public callers and preserve only
-- the two intentional execution contexts.
revoke all on function public.klyx_profile_has_type(uuid, text)
  from public, anon;
grant execute on function public.klyx_profile_has_type(uuid, text)
  to authenticated, service_role;

commit;
