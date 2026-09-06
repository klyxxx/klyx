-- KLYX_REMAINING_RLS_INITPLAN_OPTIMIZATION
--
-- Supabase's auth_rls_initplan advisor warns when auth.uid() is evaluated
-- per row inside RLS policies. Wrapping the call in a scalar SELECT lets
-- PostgreSQL evaluate it once per statement without changing authorization
-- semantics.
--
-- This migration deliberately ALTERs only the eleven remaining SELECT
-- policies reported by the live advisor. Policy names, roles, commands,
-- permissive behavior and authorization branches stay intact.

begin;

alter policy "Clients read own memory profile"
on public.client_memory_profiles
using (
  profile_id in (
    select profiles.id
    from public.profiles as profiles
    where profiles.owner_user_id = (select auth.uid())
      and profiles.account_type = 'client'::text
  )
);

alter policy "Providers read own assistant drafts"
on public.provider_assistant_drafts
using (
  profile_id in (
    select profiles.id
    from public.profiles as profiles
    where profiles.owner_user_id = (select auth.uid())
      and profiles.account_type = 'provider'::text
  )
);

alter policy "Clients read own quotes"
on public.service_quotes
using (
  client_profile_id in (
    select profiles.id
    from public.profiles as profiles
    where profiles.owner_user_id = (select auth.uid())
      and profiles.account_type = 'client'::text
  )
);

alter policy "Providers read own quotes"
on public.service_quotes
using (
  provider_profile_id in (
    select profiles.id
    from public.profiles as profiles
    where profiles.owner_user_id = (select auth.uid())
      and profiles.account_type = 'provider'::text
  )
);

alter policy "Participants read own disputes"
on public.disputes
using (
  opened_by in (
    select profiles.id
    from public.profiles as profiles
    where profiles.owner_user_id = (select auth.uid())
  )
  or against_profile_id in (
    select profiles.id
    from public.profiles as profiles
    where profiles.owner_user_id = (select auth.uid())
  )
);

alter policy "Participants read dispute events"
on public.dispute_events
using (
  exists (
    select 1
    from public.disputes as d
    where d.id = dispute_events.dispute_id
      and (
        d.opened_by in (
          select profiles.id
          from public.profiles as profiles
          where profiles.owner_user_id = (select auth.uid())
        )
        or d.against_profile_id in (
          select profiles.id
          from public.profiles as profiles
          where profiles.owner_user_id = (select auth.uid())
        )
      )
  )
);

alter policy "Profiles read own risk assessment"
on public.profile_risk_assessments
using (
  profile_id in (
    select profiles.id
    from public.profiles as profiles
    where profiles.owner_user_id = (select auth.uid())
  )
);

alter policy "Profiles read own security alerts"
on public.security_alerts
using (
  profile_id in (
    select profiles.id
    from public.profiles as profiles
    where profiles.owner_user_id = (select auth.uid())
  )
);

alter policy "Clients read own agent plans"
on public.client_agent_plans
using (
  profile_id in (
    select profiles.id
    from public.profiles as profiles
    where profiles.owner_user_id = (select auth.uid())
      and profiles.account_type = 'client'::text
  )
);

alter policy "Providers read own verification"
on public.provider_verifications
using (
  profile_id in (
    select profiles.id
    from public.profiles as profiles
    where profiles.owner_user_id = (select auth.uid())
      and profiles.account_type = 'provider'::text
  )
);

alter policy "Providers read own verification documents"
on public.provider_verification_documents
using (
  profile_id in (
    select profiles.id
    from public.profiles as profiles
    where profiles.owner_user_id = (select auth.uid())
      and profiles.account_type = 'provider'::text
  )
);

-- Fail closed if any target policy metadata or initplan optimization drifts.
do $klyx_remaining_initplan$
declare
  metadata_drift_count integer;
  initplan_drift_count integer;
begin
  with expected(tablename, policyname) as (
    values
      ('client_memory_profiles'::name, 'Clients read own memory profile'::name),
      ('provider_assistant_drafts'::name, 'Providers read own assistant drafts'::name),
      ('service_quotes'::name, 'Clients read own quotes'::name),
      ('service_quotes'::name, 'Providers read own quotes'::name),
      ('disputes'::name, 'Participants read own disputes'::name),
      ('dispute_events'::name, 'Participants read dispute events'::name),
      ('profile_risk_assessments'::name, 'Profiles read own risk assessment'::name),
      ('security_alerts'::name, 'Profiles read own security alerts'::name),
      ('client_agent_plans'::name, 'Clients read own agent plans'::name),
      ('provider_verifications'::name, 'Providers read own verification'::name),
      ('provider_verification_documents'::name, 'Providers read own verification documents'::name)
  )
  select count(*)
  into metadata_drift_count
  from expected
  left join pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = expected.tablename
   and policy.policyname = expected.policyname
  where policy.policyname is null
     or policy.permissive <> 'PERMISSIVE'
     or policy.roles <> array['authenticated']::name[]
     or policy.cmd <> 'SELECT'
     or policy.with_check is not null;

  if metadata_drift_count <> 0 then
    raise exception 'KLYX_REMAINING_RLS_INITPLAN_POLICY_METADATA_DRIFT';
  end if;

  with expected(tablename, policyname) as (
    values
      ('client_memory_profiles'::name, 'Clients read own memory profile'::name),
      ('provider_assistant_drafts'::name, 'Providers read own assistant drafts'::name),
      ('service_quotes'::name, 'Clients read own quotes'::name),
      ('service_quotes'::name, 'Providers read own quotes'::name),
      ('disputes'::name, 'Participants read own disputes'::name),
      ('dispute_events'::name, 'Participants read dispute events'::name),
      ('profile_risk_assessments'::name, 'Profiles read own risk assessment'::name),
      ('security_alerts'::name, 'Profiles read own security alerts'::name),
      ('client_agent_plans'::name, 'Clients read own agent plans'::name),
      ('provider_verifications'::name, 'Providers read own verification'::name),
      ('provider_verification_documents'::name, 'Providers read own verification documents'::name)
  )
  select count(*)
  into initplan_drift_count
  from expected
  join pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = expected.tablename
   and policy.policyname = expected.policyname
  where position('auth.uid()' in coalesce(policy.qual, '')) = 0
     or position('SELECT auth.uid()' in coalesce(policy.qual, '')) = 0;

  if initplan_drift_count <> 0 then
    raise exception 'KLYX_REMAINING_RLS_INITPLAN_SEMANTICS_DRIFT';
  end if;

  if not exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'service_quotes'
      and policy.policyname = 'Clients read own quotes'
      and position('client_profile_id' in coalesce(policy.qual, '')) > 0
      and position('account_type' in coalesce(policy.qual, '')) > 0
      and position('client' in coalesce(policy.qual, '')) > 0
  ) or not exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'service_quotes'
      and policy.policyname = 'Providers read own quotes'
      and position('provider_profile_id' in coalesce(policy.qual, '')) > 0
      and position('account_type' in coalesce(policy.qual, '')) > 0
      and position('provider' in coalesce(policy.qual, '')) > 0
  ) then
    raise exception 'KLYX_REMAINING_RLS_INITPLAN_QUOTE_BOUNDARY_DRIFT';
  end if;

  if not exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'disputes'
      and policy.policyname = 'Participants read own disputes'
      and position('opened_by' in coalesce(policy.qual, '')) > 0
      and position('against_profile_id' in coalesce(policy.qual, '')) > 0
  ) or not exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'dispute_events'
      and policy.policyname = 'Participants read dispute events'
      and position('dispute_id' in coalesce(policy.qual, '')) > 0
      and position('opened_by' in coalesce(policy.qual, '')) > 0
      and position('against_profile_id' in coalesce(policy.qual, '')) > 0
  ) then
    raise exception 'KLYX_REMAINING_RLS_INITPLAN_DISPUTE_BOUNDARY_DRIFT';
  end if;
end;
$klyx_remaining_initplan$;

commit;
