-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations\20260813133700_klyx_split_booking_batch_13_19.sql
-- SHA256: d0596aa89a3e6b9c02c04275b7f328ec42b41eab9c7a1086b5315dcf09bfc162
-- PHASE: 06_split_missions
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
-- KLYX_SPLIT_BOOKING_BATCH_13_19

create table if not exists public.split_booking_batches (
  id uuid primary key default gen_random_uuid(),

  market_request_id uuid not null
    references public.market_service_requests(id)
    on delete cascade,

  client_profile_id uuid not null
    references public.profiles(id)
    on delete cascade,

  confirmation_id uuid not null
    references public.market_split_plan_confirmations(id)
    on delete restrict,

  plan_hash text not null,

  status text not null
    default 'creating',

  expected_booking_count integer not null,

  provider_count integer not null,

  created_booking_count integer not null
    default 0,

  created_at timestamptz not null
    default now(),

  completed_at timestamptz,

  failed_at timestamptz,

  failure_reason text,

  updated_at timestamptz not null
    default now(),

  constraint klyx_split_booking_batch_status_13_19
    check (
      status in (
        'creating',
        'created',
        'failed'
      )
    ),

  constraint klyx_split_booking_batch_count_13_19
    check (
      expected_booking_count >= 2
      and provider_count >= 2
      and created_booking_count >= 0
    ),

  constraint klyx_split_booking_batch_hash_13_19
    check (
      char_length(plan_hash) = 64
    )
);

create unique index if not exists
  klyx_split_booking_confirmation_unique_13_19
on public.split_booking_batches (
  confirmation_id
);

create index if not exists
  klyx_split_booking_request_idx_13_19
on public.split_booking_batches (
  market_request_id,
  created_at desc
);


create table if not exists public.split_booking_batch_items (
  id uuid primary key default gen_random_uuid(),

  batch_id uuid not null
    references public.split_booking_batches(id)
    on delete cascade,

  booking_id uuid not null
    references public.bookings(id)
    on delete cascade,

  slot_id text not null,

  slot_position integer not null,

  provider_profile_id uuid not null
    references public.profiles(id)
    on delete restrict,

  user_service_id uuid not null
    references public.user_services(id)
    on delete restrict,

  created_at timestamptz not null
    default now(),

  constraint klyx_split_booking_item_position_13_19
    check (
      slot_position >= 1
    )
);

create unique index if not exists
  klyx_split_booking_slot_unique_13_19
on public.split_booking_batch_items (
  batch_id,
  slot_id
);

create unique index if not exists
  klyx_split_booking_booking_unique_13_19
on public.split_booking_batch_items (
  booking_id
);

alter table
  public.split_booking_batches
enable row level security;

alter table
  public.split_booking_batch_items
enable row level security;