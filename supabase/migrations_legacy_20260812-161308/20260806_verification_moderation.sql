begin;

create table if not exists public.provider_verification_reviews (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.provider_verifications(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_user_id uuid null,
  action text not null,
  note text null,
  automatic_checks jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint provider_verification_reviews_action_check check (
    action = any (
      array[
        'automatic_precheck'::text,
        'under_review'::text,
        'approved'::text,
        'changes_required'::text,
        'rejected'::text,
        'reopened'::text
      ]
    )
  )
);

create index if not exists provider_verification_reviews_verification_idx
  on public.provider_verification_reviews(verification_id, created_at desc);

create index if not exists provider_verification_reviews_profile_idx
  on public.provider_verification_reviews(profile_id, created_at desc);

alter table public.provider_verification_reviews enable row level security;

drop policy if exists "Providers read own verification review history"
  on public.provider_verification_reviews;

create policy "Providers read own verification review history"
on public.provider_verification_reviews
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
