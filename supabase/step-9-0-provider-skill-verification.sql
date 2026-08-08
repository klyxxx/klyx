-- KLYX ETAPE 9.0
-- Verification des competences par metier / prestation.

create extension if not exists pgcrypto;

create table if not exists public.provider_skill_verifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  user_service_id uuid not null,
  status text not null default 'not_started'
    check (
      status in (
        'not_started',
        'submitted',
        'under_review',
        'approved',
        'changes_required',
        'rejected'
      )
    ),
  provider_statement text,
  years_experience integer
    check (years_experience is null or years_experience between 0 and 80),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, user_service_id)
);

create table if not exists public.provider_skill_documents (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null
    references public.provider_skill_verifications(id)
    on delete cascade,
  profile_id uuid not null,
  user_service_id uuid not null,
  proof_type text not null
    check (
      proof_type in (
        'diploma',
        'training_certificate',
        'professional_license',
        'insurance',
        'experience_reference',
        'portfolio',
        'other'
      )
    ),
  original_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null
    check (size_bytes > 0 and size_bytes <= 10485760),
  status text not null default 'uploaded'
    check (
      status in (
        'uploaded',
        'under_review',
        'approved',
        'rejected'
      )
    ),
  rejection_reason text,
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

create index if not exists provider_skill_verifications_profile_idx
  on public.provider_skill_verifications(profile_id, updated_at desc);

create index if not exists provider_skill_verifications_service_idx
  on public.provider_skill_verifications(user_service_id, status);

create index if not exists provider_skill_documents_verification_idx
  on public.provider_skill_documents(verification_id, uploaded_at desc);

alter table public.provider_skill_verifications enable row level security;
alter table public.provider_skill_documents enable row level security;

-- Pas de policy utilisateur directe.
-- Les ecritures/lectures sensibles passent par les API serveur KLYX.
-- Le Storage existant provider-verification reste utilise.

comment on table public.provider_skill_verifications is
  'Un dossier de competence KLYX par profil prestataire et par user_service.';

comment on table public.provider_skill_documents is
  'Preuves privees attachees a une competence/metier precis.';
