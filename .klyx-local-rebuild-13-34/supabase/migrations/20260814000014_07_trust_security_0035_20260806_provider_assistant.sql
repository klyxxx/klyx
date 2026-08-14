-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations_legacy_20260812-161308\20260806_provider_assistant.sql
-- SHA256: 7060f821a0335e14225539bfc1352186893c3fee2baac3adb8401a9274a4d24c
-- PHASE: 07_trust_security
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
begin;

create table if not exists public.provider_assistant_drafts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  draft_type text not null,
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  applied_at timestamp with time zone null,
  constraint provider_assistant_drafts_type_check check (
    draft_type = any (
      array[
        'availability'::text,
        'client_reply'::text,
        'quote'::text
      ]
    )
  ),
  constraint provider_assistant_drafts_status_check check (
    status = any (
      array[
        'draft'::text,
        'applied'::text,
        'discarded'::text
      ]
    )
  )
);

create index if not exists provider_assistant_drafts_profile_idx
  on public.provider_assistant_drafts(profile_id, created_at desc);

alter table public.provider_assistant_drafts enable row level security;

drop policy if exists "Providers read own assistant drafts"
  on public.provider_assistant_drafts;

create policy "Providers read own assistant drafts"
on public.provider_assistant_drafts
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

commit;
