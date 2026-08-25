-- ============================================================
-- KLYX PROVIDER CAPABILITIES FOUNDATION
-- Additive foundation for free-form provider capabilities.
--
-- Domain boundary:
-- - services = canonical KLYX catalog entries
-- - user_services + service_profiles = concrete bookable provider offers
-- - provider_capabilities = what a provider says they can actually do
--
-- A capability does not require a canonical service mapping.
-- A capability does not imply a qualification or legal authorization.
-- Existing booking, search, payment and publication models are unchanged.
-- ============================================================

begin;

create table if not exists public.provider_capabilities (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid not null
    references public.profiles(id) on delete cascade,
  label text not null,
  normalized_label text not null,
  description text,
  origin_text text,
  source text not null default 'provider',
  status text not null default 'draft',
  canonical_service_id uuid
    references public.services(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint provider_capabilities_label_check
    check (char_length(btrim(label)) between 2 and 160),
  constraint provider_capabilities_normalized_label_check
    check (char_length(btrim(normalized_label)) between 2 and 160),
  constraint provider_capabilities_description_check
    check (description is null or char_length(description) <= 1200),
  constraint provider_capabilities_origin_text_check
    check (origin_text is null or char_length(origin_text) <= 3000),
  constraint provider_capabilities_source_check
    check (source in ('provider', 'assistant')),
  constraint provider_capabilities_status_check
    check (status in ('draft', 'confirmed', 'archived'))
);

comment on table public.provider_capabilities is
  'Compétences/capacités libres déclarées par un prestataire, indépendantes du catalogue canonique et des qualifications.';
comment on column public.provider_capabilities.canonical_service_id is
  'Rattachement canonique optionnel. NULL signifie que KLYX ne connaît pas encore nécessairement cette capacité dans son catalogue.';
comment on column public.provider_capabilities.origin_text is
  'Texte libre à l’origine de la capacité, par exemple la réponse à « Qu’est-ce que vous savez faire ? ».';
comment on column public.provider_capabilities.status is
  'draft = proposé/non confirmé, confirmed = confirmé par le prestataire, archived = masqué sans perte historique.';

create unique index if not exists provider_capabilities_active_label_unique
  on public.provider_capabilities (profile_id, normalized_label)
  where status <> 'archived';

create index if not exists provider_capabilities_profile_status_idx
  on public.provider_capabilities (profile_id, status, updated_at desc);

create index if not exists provider_capabilities_canonical_service_idx
  on public.provider_capabilities (canonical_service_id)
  where canonical_service_id is not null;

alter table public.provider_capabilities enable row level security;

drop policy if exists "Providers read own capabilities"
  on public.provider_capabilities;
create policy "Providers read own capabilities"
  on public.provider_capabilities
  for select
  to authenticated
  using (public.klyx_owns_profile(profile_id));

drop policy if exists "Providers create own capabilities"
  on public.provider_capabilities;
create policy "Providers create own capabilities"
  on public.provider_capabilities
  for insert
  to authenticated
  with check (public.klyx_owns_profile(profile_id));

drop policy if exists "Providers update own capabilities"
  on public.provider_capabilities;
create policy "Providers update own capabilities"
  on public.provider_capabilities
  for update
  to authenticated
  using (public.klyx_owns_profile(profile_id))
  with check (public.klyx_owns_profile(profile_id));

drop policy if exists "Providers delete own capabilities"
  on public.provider_capabilities;
create policy "Providers delete own capabilities"
  on public.provider_capabilities
  for delete
  to authenticated
  using (public.klyx_owns_profile(profile_id));

grant select, insert, update, delete
  on table public.provider_capabilities
  to authenticated;
grant all
  on table public.provider_capabilities
  to service_role;

commit;
