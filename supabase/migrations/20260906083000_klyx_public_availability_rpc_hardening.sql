-- KLYX PUBLIC AVAILABILITY RPC HARDENING
--
-- The public catalog must keep reading published/approved provider services and
-- availability, but the SECURITY DEFINER predicates must not remain callable as
-- exposed public RPCs by browser roles. Keep the privileged predicate in an
-- internal schema, point RLS at it, and reserve the legacy public wrappers for
-- service_role compatibility only.

begin;

create schema if not exists klyx_private;
revoke all on schema klyx_private from public;
grant usage on schema klyx_private to anon, authenticated, service_role;

create or replace function klyx_private.klyx_public_provider_service(
  p_user_service_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_services as user_service
    join public.service_profiles as service_profile
      on service_profile.user_service_id = user_service.id
    join public.provider_profiles as provider_profile
      on provider_profile.profile_id = user_service.user_id
    join public.provider_skill_verifications as verification
      on verification.user_service_id = user_service.id
     and verification.profile_id = user_service.user_id
     and verification.status = 'approved'
    where user_service.id = p_user_service_id
      and user_service.active = true
      and user_service.provider_enabled = true
      and service_profile.available = true
      and provider_profile.is_published = true
  );
$$;

revoke all privileges on function klyx_private.klyx_public_provider_service(uuid)
  from public, anon, authenticated, service_role;
grant execute on function klyx_private.klyx_public_provider_service(uuid)
  to anon, authenticated, service_role;

-- Browser SELECT remains available through RLS, but the policy now calls the
-- internal helper rather than an RPC in the exposed public schema.
drop policy if exists "klyx_availability_select"
  on public.availability_slots;
create policy "klyx_availability_select"
  on public.availability_slots
  for select
  to anon, authenticated
  using (
    klyx_private.klyx_public_provider_service(user_service_id)
  );

drop policy if exists "klyx_user_services_authenticated_select"
  on public.user_services;
drop policy if exists "klyx_user_services_public_select"
  on public.user_services;

create policy "klyx_user_services_authenticated_select"
  on public.user_services
  for select
  to authenticated
  using (
    public.klyx_owns_profile(user_id)
    or klyx_private.klyx_public_provider_service(id)
  );

create policy "klyx_user_services_public_select"
  on public.user_services
  for select
  to anon
  using (
    klyx_private.klyx_public_provider_service(id)
  );

drop policy if exists "klyx_service_profiles_authenticated_select"
  on public.service_profiles;
drop policy if exists "klyx_service_profiles_public_select"
  on public.service_profiles;

create policy "klyx_service_profiles_authenticated_select"
  on public.service_profiles
  for select
  to authenticated
  using (
    public.klyx_owns_user_service(user_service_id)
    or klyx_private.klyx_public_provider_service(user_service_id)
  );

create policy "klyx_service_profiles_public_select"
  on public.service_profiles
  for select
  to anon
  using (
    klyx_private.klyx_public_provider_service(user_service_id)
  );

-- Keep legacy server-side callers working, but remove direct browser execution
-- from both exposed SECURITY DEFINER wrappers.
create or replace function public.klyx_public_provider_service(
  p_user_service_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select klyx_private.klyx_public_provider_service(p_user_service_id);
$$;

revoke all privileges on function public.klyx_public_provider_service(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.klyx_public_provider_service(uuid)
  to service_role;

create or replace function public.klyx_public_availability_service(
  p_user_service_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select klyx_private.klyx_public_provider_service(p_user_service_id);
$$;

revoke all privileges on function public.klyx_public_availability_service(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.klyx_public_availability_service(uuid)
  to service_role;

-- Fail closed if a future edit re-exposes either public SECURITY DEFINER RPC or
-- reconnects browser RLS policies to the exposed wrappers.
do $$
declare
  function_signature text;
  function_oid regprocedure;
  role_name text;
begin
  foreach function_signature in array array[
    'public.klyx_public_provider_service(uuid)',
    'public.klyx_public_availability_service(uuid)'
  ]
  loop
    function_oid := to_regprocedure(function_signature);

    if function_oid is null then
      raise exception
        'KLYX_AVAILABILITY_RPC_SENTINEL_FUNCTION_MISSING:%',
        function_signature
        using errcode = 'P0001';
    end if;

    foreach role_name in array array['anon', 'authenticated']
    loop
      if has_function_privilege(role_name, function_oid, 'EXECUTE') then
        raise exception
          'KLYX_AVAILABILITY_RPC_SENTINEL_BROWSER_EXECUTE_LEAK:role=% function=%',
          role_name,
          function_signature
          using errcode = 'P0001';
      end if;
    end loop;

    if not has_function_privilege('service_role', function_oid, 'EXECUTE') then
      raise exception
        'KLYX_AVAILABILITY_RPC_SENTINEL_SERVICE_ROLE_EXECUTE_MISSING:%',
        function_signature
        using errcode = 'P0001';
    end if;
  end loop;

  if exists (
    select 1
    from pg_policy as policy
    where coalesce(pg_get_expr(policy.polqual, policy.polrelid), '')
      like '%public.klyx_public_provider_service%'
       or coalesce(pg_get_expr(policy.polqual, policy.polrelid), '')
      like '%public.klyx_public_availability_service%'
  ) then
    raise exception
      'KLYX_AVAILABILITY_RPC_SENTINEL_PUBLIC_POLICY_DEPENDENCY'
      using errcode = 'P0001';
  end if;
end;
$$;

commit;
