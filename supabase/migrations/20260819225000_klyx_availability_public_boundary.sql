-- KLYX_AVAILABILITY_PUBLIC_BOUNDARY_12B_13A
--
-- Public provider and booking pages currently read availability_slots directly,
-- so SELECT must remain available to browser roles. The historical SELECT policy
-- used USING (true), however, which allowed enumeration of raw schedules for any
-- user_service_id. Provider Studio already performs all availability mutations
-- through supabaseAdmin.
--
-- Keep only public SELECT, restrict it to a genuinely public provider service,
-- and move INSERT/UPDATE/DELETE behind the server boundary.

begin;

create or replace function public.klyx_public_availability_service(
  p_user_service_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_services as user_service
    join public.service_profiles as service_profile
      on service_profile.user_service_id = user_service.id
    join public.provider_skill_verifications as verification
      on verification.user_service_id = user_service.id
     and verification.profile_id = user_service.user_id
     and verification.status = 'approved'
    where user_service.id = p_user_service_id
      and user_service.active = true
      and user_service.provider_enabled = true
      and service_profile.available = true
  );
$$;

revoke all privileges on function public.klyx_public_availability_service(uuid)
  from public, anon, authenticated;
grant execute on function public.klyx_public_availability_service(uuid)
  to anon, authenticated, service_role;

revoke all privileges on table public.availability_slots
  from public, anon, authenticated;
grant select on table public.availability_slots
  to anon, authenticated;
grant all privileges on table public.availability_slots
  to service_role;

drop policy if exists "klyx_availability_delete"
  on public.availability_slots;
drop policy if exists "klyx_availability_insert"
  on public.availability_slots;
drop policy if exists "klyx_availability_update"
  on public.availability_slots;
drop policy if exists "klyx_availability_select"
  on public.availability_slots;

create policy "klyx_availability_select"
  on public.availability_slots
  for select
  to anon, authenticated
  using (
    public.klyx_public_availability_service(user_service_id)
  );

commit;
