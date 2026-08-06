begin;

create table if not exists public.provider_verifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'not_started',
  identity_status text not null default 'missing',
  address_status text not null default 'missing',
  business_status text not null default 'optional',
  insurance_status text not null default 'optional',
  professional_status text not null default 'optional',
  trust_level text not null default 'new',
  submitted_at timestamp with time zone null,
  reviewed_at timestamp with time zone null,
  review_note text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint provider_verifications_profile_unique unique(profile_id),
  constraint provider_verifications_status_check check (
    status = any (
      array[
        'not_started'::text,
        'incomplete'::text,
        'submitted'::text,
        'under_review'::text,
        'approved'::text,
        'changes_required'::text,
        'rejected'::text
      ]
    )
  ),
  constraint provider_verifications_document_status_check check (
    identity_status = any (
      array['missing'::text, 'uploaded'::text, 'under_review'::text, 'approved'::text, 'rejected'::text]
    )
    and address_status = any (
      array['missing'::text, 'uploaded'::text, 'under_review'::text, 'approved'::text, 'rejected'::text]
    )
    and business_status = any (
      array['optional'::text, 'missing'::text, 'uploaded'::text, 'under_review'::text, 'approved'::text, 'rejected'::text]
    )
    and insurance_status = any (
      array['optional'::text, 'missing'::text, 'uploaded'::text, 'under_review'::text, 'approved'::text, 'rejected'::text]
    )
    and professional_status = any (
      array['optional'::text, 'missing'::text, 'uploaded'::text, 'under_review'::text, 'approved'::text, 'rejected'::text]
    )
  ),
  constraint provider_verifications_trust_level_check check (
    trust_level = any (
      array[
        'new'::text,
        'identity_verified'::text,
        'professional'::text,
        'expert'::text
      ]
    )
  )
);

create table if not exists public.provider_verification_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null,
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  status text not null default 'uploaded',
  rejection_reason text null,
  uploaded_at timestamp with time zone not null default now(),
  reviewed_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  constraint provider_verification_documents_path_unique unique(storage_path),
  constraint provider_verification_documents_type_check check (
    document_type = any (
      array[
        'identity'::text,
        'address'::text,
        'business'::text,
        'insurance'::text,
        'professional_certificate'::text
      ]
    )
  ),
  constraint provider_verification_documents_status_check check (
    status = any (
      array[
        'uploaded'::text,
        'under_review'::text,
        'approved'::text,
        'rejected'::text
      ]
    )
  ),
  constraint provider_verification_documents_size_check check (
    size_bytes > 0 and size_bytes <= 10485760
  )
);

create index if not exists provider_verification_documents_profile_idx
  on public.provider_verification_documents(profile_id, uploaded_at desc);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'provider-verification',
  'provider-verification',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.provider_verifications enable row level security;
alter table public.provider_verification_documents enable row level security;

drop policy if exists "Providers read own verification"
  on public.provider_verifications;

create policy "Providers read own verification"
on public.provider_verifications
for select
to authenticated
using (
  profile_id in (
    select id
    from public.profiles
    where owner_user_id = auth.uid()
      and account_type = 'provider'
  )
);

drop policy if exists "Providers read own verification documents"
  on public.provider_verification_documents;

create policy "Providers read own verification documents"
on public.provider_verification_documents
for select
to authenticated
using (
  profile_id in (
    select id
    from public.profiles
    where owner_user_id = auth.uid()
      and account_type = 'provider'
  )
);

drop policy if exists "Providers upload own private verification files"
  on storage.objects;

create policy "Providers upload own private verification files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'provider-verification'
  and (storage.foldername(name))[1] in (
    select id::text
    from public.profiles
    where owner_user_id = auth.uid()
      and account_type = 'provider'
  )
);

drop policy if exists "Providers read own private verification files"
  on storage.objects;

create policy "Providers read own private verification files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'provider-verification'
  and (storage.foldername(name))[1] in (
    select id::text
    from public.profiles
    where owner_user_id = auth.uid()
      and account_type = 'provider'
  )
);

drop policy if exists "Providers delete own private verification files"
  on storage.objects;

create policy "Providers delete own private verification files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'provider-verification'
  and (storage.foldername(name))[1] in (
    select id::text
    from public.profiles
    where owner_user_id = auth.uid()
      and account_type = 'provider'
  )
);

commit;
