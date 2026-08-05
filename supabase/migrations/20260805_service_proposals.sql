create table if not exists public.service_proposals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  proposed_name text not null,
  category text not null,
  description text not null,
  experience_details text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_proposals_profile_id_idx
  on public.service_proposals(profile_id);

create index if not exists service_proposals_status_idx
  on public.service_proposals(status);

alter table public.service_proposals enable row level security;

drop policy if exists "Providers can read own service proposals"
  on public.service_proposals;

create policy "Providers can read own service proposals"
  on public.service_proposals
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = service_proposals.profile_id
        and profiles.owner_user_id = auth.uid()
        and profiles.account_type = 'provider'
    )
  );

drop policy if exists "Providers can create own service proposals"
  on public.service_proposals;

create policy "Providers can create own service proposals"
  on public.service_proposals
  for insert
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = service_proposals.profile_id
        and profiles.owner_user_id = auth.uid()
        and profiles.account_type = 'provider'
    )
  );

comment on table public.service_proposals is
  'Métiers proposés par les prestataires avant validation et ajout au catalogue KLYX.';
