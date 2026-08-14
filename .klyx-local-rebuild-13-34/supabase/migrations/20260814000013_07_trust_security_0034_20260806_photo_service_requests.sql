-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations_legacy_20260812-161308\20260806_photo_service_requests.sql
-- SHA256: 82e2616310faaae7c98d8091b0bf9dbc0d711590d8d3f9ba0fd70f8e0ea56a37
-- PHASE: 07_trust_security
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
begin;

create table if not exists public.photo_service_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  width integer null,
  height integer null,
  user_description text not null,
  detected_service_slug text null,
  analysis_mode text not null default 'description_assisted',
  analysis_payload jsonb not null default '{}'::jsonb,
  status text not null default 'analyzed',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint photo_service_requests_storage_path_unique unique(storage_path),
  constraint photo_service_requests_size_check check (
    size_bytes > 0 and size_bytes <= 10485760
  ),
  constraint photo_service_requests_analysis_mode_check check (
    analysis_mode = any (
      array[
        'description_assisted'::text,
        'vision_ai'::text
      ]
    )
  ),
  constraint photo_service_requests_status_check check (
    status = any (
      array[
        'uploaded'::text,
        'analyzed'::text,
        'converted_to_search'::text,
        'deleted'::text
      ]
    )
  )
);

create index if not exists photo_service_requests_profile_idx
  on public.photo_service_requests(profile_id, created_at desc);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'client-service-photos',
  'client-service-photos',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.photo_service_requests enable row level security;

drop policy if exists "Clients read own photo requests"
  on public.photo_service_requests;

create policy "Clients read own photo requests"
on public.photo_service_requests
for select
to authenticated
using (
  profile_id in (
    select id
    from public.profiles
    where owner_user_id = auth.uid()
      and account_type = 'client'
  )
);

drop policy if exists "Clients upload own private service photos"
  on storage.objects;

create policy "Clients upload own private service photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'client-service-photos'
  and (storage.foldername(name))[1] in (
    select id::text
    from public.profiles
    where owner_user_id = auth.uid()
      and account_type = 'client'
  )
);

drop policy if exists "Clients read own private service photos"
  on storage.objects;

create policy "Clients read own private service photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'client-service-photos'
  and (storage.foldername(name))[1] in (
    select id::text
    from public.profiles
    where owner_user_id = auth.uid()
      and account_type = 'client'
  )
);

drop policy if exists "Clients delete own private service photos"
  on storage.objects;

create policy "Clients delete own private service photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'client-service-photos'
  and (storage.foldername(name))[1] in (
    select id::text
    from public.profiles
    where owner_user_id = auth.uid()
      and account_type = 'client'
  )
);

commit;
