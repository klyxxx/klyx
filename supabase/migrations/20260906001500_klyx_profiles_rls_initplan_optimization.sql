-- KLY-13 / KLYX_PROFILES_RLS_INITPLAN_OPTIMIZATION
--
-- Supabase's auth_rls_initplan advisor warns when auth.uid() is evaluated
-- per row inside RLS policies. Wrapping the call in a scalar SELECT lets
-- PostgreSQL evaluate it once per statement without changing authorization
-- semantics.
--
-- This migration deliberately ALTERs only the four existing profiles
-- policies. Their names, commands, roles and permissive behavior stay intact.

begin;

alter policy klyx_profiles_insert
on public.profiles
with check (owner_user_id = (select auth.uid()));

alter policy klyx_profiles_update
on public.profiles
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));

alter policy klyx_profiles_delete
on public.profiles
using (owner_user_id = (select auth.uid()));

alter policy klyx_profiles_authenticated_select
on public.profiles
using (
  owner_user_id = (select auth.uid())
  or klyx_shares_booking_with_profile(id)
  or (
    account_type = 'provider'
    and exists (
      select 1
      from public.provider_profiles provider_profile
      where provider_profile.profile_id = profiles.id
        and provider_profile.is_published = true
    )
  )
);

-- Fail closed if the policy metadata or any authorization branch drifts.
do $kly13$
declare
  metadata_drift_count integer;
begin
  select count(*)
  into metadata_drift_count
  from (
    values
      ('klyx_profiles_insert'::name, 'INSERT'::text),
      ('klyx_profiles_update'::name, 'UPDATE'::text),
      ('klyx_profiles_delete'::name, 'DELETE'::text),
      ('klyx_profiles_authenticated_select'::name, 'SELECT'::text)
  ) as expected(policyname, command)
  left join pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = 'profiles'
   and policy.policyname = expected.policyname
  where policy.policyname is null
     or policy.permissive <> 'PERMISSIVE'
     or policy.roles <> array['authenticated']::name[]
     or policy.cmd <> expected.command;

  if metadata_drift_count <> 0 then
    raise exception 'KLYX_KLY_13_PROFILE_POLICY_METADATA_DRIFT';
  end if;

  if not exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'profiles'
      and policy.policyname = 'klyx_profiles_insert'
      and policy.qual is null
      and position('owner_user_id' in coalesce(policy.with_check, '')) > 0
      and position('SELECT auth.uid()' in coalesce(policy.with_check, '')) > 0
  ) then
    raise exception 'KLYX_KLY_13_PROFILE_INSERT_SEMANTICS_DRIFT';
  end if;

  if not exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'profiles'
      and policy.policyname = 'klyx_profiles_update'
      and position('owner_user_id' in coalesce(policy.qual, '')) > 0
      and position('SELECT auth.uid()' in coalesce(policy.qual, '')) > 0
      and position('owner_user_id' in coalesce(policy.with_check, '')) > 0
      and position('SELECT auth.uid()' in coalesce(policy.with_check, '')) > 0
  ) then
    raise exception 'KLYX_KLY_13_PROFILE_UPDATE_SEMANTICS_DRIFT';
  end if;

  if not exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'profiles'
      and policy.policyname = 'klyx_profiles_delete'
      and policy.with_check is null
      and position('owner_user_id' in coalesce(policy.qual, '')) > 0
      and position('SELECT auth.uid()' in coalesce(policy.qual, '')) > 0
  ) then
    raise exception 'KLYX_KLY_13_PROFILE_DELETE_SEMANTICS_DRIFT';
  end if;

  if not exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'profiles'
      and policy.policyname = 'klyx_profiles_authenticated_select'
      and policy.with_check is null
      and position('owner_user_id' in coalesce(policy.qual, '')) > 0
      and position('SELECT auth.uid()' in coalesce(policy.qual, '')) > 0
      and position('klyx_shares_booking_with_profile(id)' in coalesce(policy.qual, '')) > 0
      and position('account_type' in coalesce(policy.qual, '')) > 0
      and position('provider_profiles' in coalesce(policy.qual, '')) > 0
      and position('is_published = true' in coalesce(policy.qual, '')) > 0
  ) then
    raise exception 'KLYX_KLY_13_PROFILE_SELECT_SEMANTICS_DRIFT';
  end if;
end;
$kly13$;

commit;
