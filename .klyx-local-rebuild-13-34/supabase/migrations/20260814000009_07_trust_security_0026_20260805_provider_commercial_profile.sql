-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations_legacy_20260812-161308\20260805_provider_commercial_profile.sql
-- SHA256: 8c742f942f21faa4366e4d1f98df93a1ccd18cdbcf24a1c76d57a9d9add50073
-- PHASE: 07_trust_security
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
begin;

-- Fiche commerciale générale du prestataire.
create table if not exists public.provider_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  business_name text,
  headline text,
  bio text,
  years_experience integer not null default 0,
  is_published boolean not null default false,
  verification_status text not null default 'not_submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_profiles_years_check
    check (years_experience between 0 and 60),
  constraint provider_profiles_verification_check
    check (verification_status in ('not_submitted', 'pending', 'verified', 'rejected'))
);

-- Un service possède désormais un vrai mode tarifaire et plusieurs zones.
alter table public.service_profiles
  add column if not exists pricing_type text not null default 'hourly',
  add column if not exists service_area text[] not null default '{}'::text[],
  add column if not exists travel_radius_km integer not null default 10;

alter table public.user_services
  add column if not exists provider_enabled boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_profiles_pricing_type_check'
      and conrelid = 'public.service_profiles'::regclass
  ) then
    alter table public.service_profiles
      add constraint service_profiles_pricing_type_check
      check (pricing_type in ('hourly', 'fixed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_profiles_travel_radius_check'
      and conrelid = 'public.service_profiles'::regclass
  ) then
    alter table public.service_profiles
      add constraint service_profiles_travel_radius_check
      check (travel_radius_km between 0 and 100);
  end if;
end;
$$;

create table if not exists public.provider_gallery (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  public_url text not null,
  caption text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  storage_path text not null unique,
  status text not null default 'pending',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_documents_type_check
    check (document_type in ('identity', 'address', 'insurance', 'company')),
  constraint provider_documents_status_check
    check (status in ('pending', 'verified', 'rejected')),
  constraint provider_documents_profile_type_unique
    unique (profile_id, document_type)
);

create index if not exists provider_gallery_profile_position_idx
  on public.provider_gallery(profile_id, position, created_at);

create index if not exists provider_documents_profile_idx
  on public.provider_documents(profile_id, created_at desc);

-- Conserve l’état public des prestataires qui avaient déjà un service actif.
insert into public.provider_profiles (
  profile_id,
  headline,
  bio,
  years_experience,
  is_published,
  verification_status
)
select
  profile.id,
  'Prestataire KLYX',
  '',
  0,
  exists (
    select 1
    from public.user_services user_service
    where user_service.user_id = profile.id
      and user_service.active = true
  ),
  'not_submitted'
from public.profiles profile
where profile.account_type = 'provider'
on conflict (profile_id) do nothing;

-- Stockage privé des documents. L’application serveur est la seule à écrire.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'provider-documents',
  'provider-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.provider_profiles enable row level security;
alter table public.provider_gallery enable row level security;
alter table public.provider_documents enable row level security;

grant select on public.provider_profiles to anon, authenticated;
grant insert, update, delete on public.provider_profiles to authenticated;
grant select on public.provider_gallery to anon, authenticated;
grant insert, update, delete on public.provider_gallery to authenticated;
grant select, insert, update, delete on public.provider_documents to authenticated;

drop policy if exists "klyx_provider_profiles_select" on public.provider_profiles;
create policy "klyx_provider_profiles_select"
on public.provider_profiles
for select
to anon, authenticated
using (is_published = true or public.klyx_owns_profile(profile_id));

drop policy if exists "klyx_provider_profiles_insert" on public.provider_profiles;
create policy "klyx_provider_profiles_insert"
on public.provider_profiles
for insert
to authenticated
with check (
  public.klyx_owns_profile(profile_id)
  and public.klyx_profile_has_type(profile_id, 'provider')
);

drop policy if exists "klyx_provider_profiles_update" on public.provider_profiles;
create policy "klyx_provider_profiles_update"
on public.provider_profiles
for update
to authenticated
using (public.klyx_owns_profile(profile_id))
with check (
  public.klyx_owns_profile(profile_id)
  and public.klyx_profile_has_type(profile_id, 'provider')
);

drop policy if exists "klyx_provider_profiles_delete" on public.provider_profiles;
create policy "klyx_provider_profiles_delete"
on public.provider_profiles
for delete
to authenticated
using (public.klyx_owns_profile(profile_id));

drop policy if exists "klyx_provider_gallery_select" on public.provider_gallery;
create policy "klyx_provider_gallery_select"
on public.provider_gallery
for select
to anon, authenticated
using (
  public.klyx_owns_profile(profile_id)
  or exists (
    select 1
    from public.provider_profiles provider_profile
    where provider_profile.profile_id = provider_gallery.profile_id
      and provider_profile.is_published = true
  )
);

drop policy if exists "klyx_provider_gallery_insert" on public.provider_gallery;
create policy "klyx_provider_gallery_insert"
on public.provider_gallery
for insert
to authenticated
with check (
  public.klyx_owns_profile(profile_id)
  and public.klyx_profile_has_type(profile_id, 'provider')
);

drop policy if exists "klyx_provider_gallery_update" on public.provider_gallery;
create policy "klyx_provider_gallery_update"
on public.provider_gallery
for update
to authenticated
using (public.klyx_owns_profile(profile_id))
with check (public.klyx_owns_profile(profile_id));

drop policy if exists "klyx_provider_gallery_delete" on public.provider_gallery;
create policy "klyx_provider_gallery_delete"
on public.provider_gallery
for delete
to authenticated
using (public.klyx_owns_profile(profile_id));

drop policy if exists "klyx_provider_documents_select" on public.provider_documents;
create policy "klyx_provider_documents_select"
on public.provider_documents
for select
to authenticated
using (public.klyx_owns_profile(profile_id));

drop policy if exists "klyx_provider_documents_insert" on public.provider_documents;
create policy "klyx_provider_documents_insert"
on public.provider_documents
for insert
to authenticated
with check (
  public.klyx_owns_profile(profile_id)
  and public.klyx_profile_has_type(profile_id, 'provider')
);

drop policy if exists "klyx_provider_documents_update" on public.provider_documents;
create policy "klyx_provider_documents_update"
on public.provider_documents
for update
to authenticated
using (public.klyx_owns_profile(profile_id))
with check (public.klyx_owns_profile(profile_id));

drop policy if exists "klyx_provider_documents_delete" on public.provider_documents;
create policy "klyx_provider_documents_delete"
on public.provider_documents
for delete
to authenticated
using (public.klyx_owns_profile(profile_id));

commit;
