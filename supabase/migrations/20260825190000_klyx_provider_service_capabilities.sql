-- ============================================================
-- KLYX PROVIDER SERVICE CAPABILITIES
--
-- Additive many-to-many link between:
-- - provider_capabilities: what a provider says they can do
-- - user_services: an existing provider offer/catalog activation
--
-- A link is descriptive only. It does not publish an offer, grant a
-- qualification, change trust, create a booking or affect payment.
-- Writes stay server-only. The database itself enforces that the
-- capability and user_service belong to the exact same KLYX profile.
-- ============================================================

begin;

create table if not exists public.provider_service_capabilities (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid not null
    references public.profiles(id) on delete cascade,
  capability_id uuid not null
    references public.provider_capabilities(id) on delete cascade,
  user_service_id uuid not null
    references public.user_services(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint provider_service_capabilities_capability_service_key
    unique (capability_id, user_service_id)
);

comment on table public.provider_service_capabilities is
  'Lien confirmé many-to-many entre une capacité prestataire et une offre user_services du même profil. Aucun effet automatique sur publication, qualification, confiance, réservation ou paiement.';
comment on column public.provider_service_capabilities.profile_id is
  'Profil prestataire propriétaire commun de la capacité et de user_services.';

create index if not exists provider_service_capabilities_profile_created_idx
  on public.provider_service_capabilities (profile_id, created_at desc);
create index if not exists provider_service_capabilities_capability_idx
  on public.provider_service_capabilities (capability_id);
create index if not exists provider_service_capabilities_user_service_idx
  on public.provider_service_capabilities (user_service_id);

create or replace function public.klyx_validate_provider_service_capability_link()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  capability_profile_id uuid;
  capability_status text;
  service_profile_id uuid;
begin
  select
    capability.profile_id,
    capability.status
  into
    capability_profile_id,
    capability_status
  from public.provider_capabilities capability
  where capability.id = new.capability_id;

  select user_service.user_id
  into service_profile_id
  from public.user_services user_service
  where user_service.id = new.user_service_id;

  if
    capability_profile_id is null
    or service_profile_id is null
    or capability_profile_id is distinct from new.profile_id
    or service_profile_id is distinct from new.profile_id
  then
    raise exception using
      errcode = '23514',
      message = 'KLYX_PROVIDER_SERVICE_CAPABILITY_PROFILE_MISMATCH';
  end if;

  if capability_status <> 'confirmed' then
    raise exception using
      errcode = '23514',
      message = 'KLYX_PROVIDER_SERVICE_CAPABILITY_REQUIRES_CONFIRMED_CAPABILITY';
  end if;

  return new;
end;
$$;

revoke all on function public.klyx_validate_provider_service_capability_link()
  from public, anon, authenticated;
grant execute on function public.klyx_validate_provider_service_capability_link()
  to service_role;

drop trigger if exists provider_service_capabilities_validate_owner
  on public.provider_service_capabilities;
create trigger provider_service_capabilities_validate_owner
before insert or update of profile_id, capability_id, user_service_id
on public.provider_service_capabilities
for each row
execute function public.klyx_validate_provider_service_capability_link();

alter table public.provider_service_capabilities enable row level security;

drop policy if exists "Providers read own service capability links"
  on public.provider_service_capabilities;
create policy "Providers read own service capability links"
  on public.provider_service_capabilities
  for select
  to authenticated
  using (public.klyx_owns_profile(profile_id));

revoke all on table public.provider_service_capabilities
  from anon, authenticated;
grant select on table public.provider_service_capabilities
  to authenticated;
grant all on table public.provider_service_capabilities
  to service_role;

commit;
