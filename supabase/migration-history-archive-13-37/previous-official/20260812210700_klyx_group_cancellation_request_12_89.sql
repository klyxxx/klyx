-- KLYX_GROUP_CANCELLATION_REQUEST_12_89

alter table public.booking_groups
  add column if not exists
    cancellation_request_status text
    not null
    default 'none'
    check (
      cancellation_request_status in (
        'none',
        'requested',
        'withdrawn',
        'resolved'
      )
    );

alter table public.booking_groups
  add column if not exists
    cancellation_requested_by uuid
    references public.profiles(id)
    on delete set null;

alter table public.booking_groups
  add column if not exists
    cancellation_requested_role text
    check (
      cancellation_requested_role is null
      or cancellation_requested_role in (
        'client',
        'provider'
      )
    );

alter table public.booking_groups
  add column if not exists
    cancellation_reason text;

alter table public.booking_groups
  add column if not exists
    cancellation_requested_at timestamptz;

alter table public.booking_groups
  add column if not exists
    cancellation_withdrawn_at timestamptz;

alter table public.booking_groups
  add column if not exists
    refund_status text
    not null
    default 'not_required'
    check (
      refund_status in (
        'not_required',
        'review_required',
        'processing',
        'refunded',
        'failed'
      )
    );

create table if not exists
  public.booking_group_cancellation_events (
    id uuid primary key
      default gen_random_uuid(),

    booking_group_id uuid not null
      references public.booking_groups(id)
      on delete cascade,

    actor_profile_id uuid not null
      references public.profiles(id)
      on delete cascade,

    actor_role text not null
      check (
        actor_role in (
          'client',
          'provider',
          'system'
        )
      ),

    action text not null
      check (
        action in (
          'requested',
          'withdrawn',
          'resolved'
        )
      ),

    reason text,

    created_at timestamptz not null
      default now()
  );

create index if not exists
  booking_group_cancellation_events_group_idx
on public.booking_group_cancellation_events (
  booking_group_id,
  created_at desc
);

create index if not exists
  booking_groups_cancellation_status_idx
on public.booking_groups (
  cancellation_request_status
);

alter table
  public.booking_group_cancellation_events
enable row level security;