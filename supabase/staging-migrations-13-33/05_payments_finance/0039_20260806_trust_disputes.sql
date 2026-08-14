-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations_legacy_20260812-161308\20260806_trust_disputes.sql
-- SHA256: 24983e51675088439db138002100d4bae79febb2366aae1e91922a72abf07d86
-- PHASE: 05_payments_finance
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
begin;

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  opened_by uuid not null references public.profiles(id) on delete restrict,
  against_profile_id uuid null references public.profiles(id) on delete set null,
  reason text not null,
  description text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  resolution text null,
  resolved_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint disputes_reason_check check (
    reason = any (
      array[
        'provider_absent'::text,
        'client_absent'::text,
        'major_delay'::text,
        'unfinished_work'::text,
        'unsatisfactory_work'::text,
        'unsafe_behavior'::text,
        'payment_problem'::text,
        'other'::text
      ]
    )
  ),
  constraint disputes_status_check check (
    status = any (
      array[
        'open'::text,
        'under_review'::text,
        'waiting_user'::text,
        'resolved'::text,
        'closed'::text
      ]
    )
  ),
  constraint disputes_priority_check check (
    priority = any (
      array[
        'normal'::text,
        'high'::text,
        'urgent'::text
      ]
    )
  ),
  constraint disputes_description_length_check check (
    char_length(description) between 20 and 2000
  )
);

create table if not exists public.dispute_events (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  actor_id uuid null references public.profiles(id) on delete set null,
  event_type text not null,
  note text null,
  created_at timestamp with time zone not null default now(),
  constraint dispute_events_type_check check (
    event_type = any (
      array[
        'opened'::text,
        'message'::text,
        'status_changed'::text,
        'resolved'::text,
        'closed'::text
      ]
    )
  )
);

create unique index if not exists disputes_one_active_per_booking_actor
  on public.disputes (booking_id, opened_by)
  where status in ('open', 'under_review', 'waiting_user');

create index if not exists disputes_opened_by_idx
  on public.disputes (opened_by, created_at desc);

create index if not exists disputes_booking_idx
  on public.disputes (booking_id, created_at desc);

create index if not exists dispute_events_dispute_idx
  on public.dispute_events (dispute_id, created_at asc);

alter table public.disputes enable row level security;
alter table public.dispute_events enable row level security;

drop policy if exists "Participants read own disputes" on public.disputes;
create policy "Participants read own disputes"
on public.disputes
for select
to authenticated
using (
  opened_by in (
    select id from public.profiles where owner_user_id = auth.uid()
  )
  or against_profile_id in (
    select id from public.profiles where owner_user_id = auth.uid()
  )
);

drop policy if exists "Participants read dispute events" on public.dispute_events;
create policy "Participants read dispute events"
on public.dispute_events
for select
to authenticated
using (
  exists (
    select 1
    from public.disputes d
    where d.id = dispute_events.dispute_id
      and (
        d.opened_by in (
          select id from public.profiles where owner_user_id = auth.uid()
        )
        or d.against_profile_id in (
          select id from public.profiles where owner_user_id = auth.uid()
        )
      )
  )
);

commit;
