-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations\20260812202000_klyx_booking_groups_12_85.sql
-- SHA256: a9f6ec16c3e113d0ef477f337c096847797c46664ccaab701133c1030d6134d9
-- PHASE: 05_payments_finance
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
-- KLYX_BOOKING_GROUPS_12_85

create table if not exists public.booking_groups (
  id uuid primary key default gen_random_uuid(),

  market_request_id uuid not null
    references public.market_service_requests(id)
    on delete cascade,

  client_profile_id uuid not null
    references public.profiles(id)
    on delete cascade,

  provider_profile_id uuid not null
    references public.profiles(id)
    on delete cascade,

  user_service_id uuid not null
    references public.user_services(id)
    on delete restrict,

  offer_id uuid not null
    references public.market_service_offers(id)
    on delete restrict,

  status text not null default 'pending_provider',

  payment_status text not null default 'unpaid',

  total_amount_cents integer not null,

  currency text not null default 'EUR',

  slot_count integer not null,

  selected_at timestamptz not null default now(),

  accepted_at timestamptz,

  rejected_at timestamptz,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint booking_groups_status_check
    check (
      status in (
        'pending_provider',
        'accepted',
        'rejected',
        'cancelled',
        'completed'
      )
    ),

  constraint booking_groups_payment_status_check
    check (
      payment_status in (
        'unpaid',
        'processing',
        'paid',
        'failed',
        'refunded'
      )
    ),

  constraint booking_groups_amount_check
    check (
      total_amount_cents > 0
    ),

  constraint booking_groups_slot_count_check
    check (
      slot_count >= 2
      and slot_count <= 20
    )
);

create unique index if not exists
  booking_groups_active_request_uidx
on public.booking_groups (
  market_request_id
)
where status in (
  'pending_provider',
  'accepted'
);

create index if not exists
  booking_groups_client_idx
on public.booking_groups (
  client_profile_id,
  created_at desc
);

create index if not exists
  booking_groups_provider_idx
on public.booking_groups (
  provider_profile_id,
  created_at desc
);

alter table public.bookings
  add column if not exists booking_group_id uuid
    references public.booking_groups(id)
    on delete cascade;

alter table public.bookings
  add column if not exists group_position integer;

create unique index if not exists
  bookings_group_position_uidx
on public.bookings (
  booking_group_id,
  group_position
)
where booking_group_id is not null;

create index if not exists
  bookings_group_idx
on public.bookings (
  booking_group_id
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'bookings_group_position_check'
  ) then
    alter table public.bookings
      add constraint bookings_group_position_check
      check (
        group_position is null
        or (
          group_position >= 1
          and group_position <= 20
        )
      );
  end if;
end
$$;

alter table public.booking_groups
  enable row level security;

revoke all
on table public.booking_groups
from anon, authenticated;

grant all
on table public.booking_groups
to service_role;

-- ===========================================================
-- ATOMIC GROUP CREATION
-- ===========================================================

create or replace function
public.klyx_create_multi_slot_booking_group(
  p_market_request_id uuid,
  p_client_profile_id uuid,
  p_offer_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;

  v_request_status text;
  v_request_mode text;
  v_service_id uuid;

  v_provider_id uuid;
  v_user_service_id uuid;
  v_offer_status text;
  v_offer_amount numeric;

  v_total_cents integer;
  v_slot_count integer;
  v_null_budget_count integer;
  v_budget_total numeric;
  v_duration_total numeric;
  v_use_budget boolean;

  v_allocated integer := 0;
  v_current_amount integer;
  v_weight numeric;
  v_index integer := 0;

  v_slot record;
  v_booking_id uuid;
begin
  select
    id
  into
    v_group_id
  from public.booking_groups
  where market_request_id =
    p_market_request_id
    and status in (
      'pending_provider',
      'accepted'
    )
  order by created_at desc
  limit 1;

  if v_group_id is not null then
    return v_group_id;
  end if;

  select
    status,
    request_mode,
    service_id
  into
    v_request_status,
    v_request_mode,
    v_service_id
  from public.market_service_requests
  where id =
    p_market_request_id
    and client_profile_id =
      p_client_profile_id
  for update;

  if not found then
    raise exception
      'KLYX_GROUP_REQUEST_NOT_FOUND';
  end if;

  if v_request_mode <> 'multi_slot' then
    raise exception
      'KLYX_GROUP_REQUEST_REQUIRED';
  end if;

  if v_request_status <> 'open' then
    raise exception
      'KLYX_GROUP_REQUEST_NOT_OPEN';
  end if;

  select
    provider_profile_id,
    user_service_id,
    status,
    amount
  into
    v_provider_id,
    v_user_service_id,
    v_offer_status,
    v_offer_amount
  from public.market_service_offers
  where id =
    p_offer_id
    and request_id =
      p_market_request_id
  for update;

  if not found then
    raise exception
      'KLYX_GROUP_OFFER_NOT_FOUND';
  end if;

  if v_offer_status <> 'sent' then
    raise exception
      'KLYX_GROUP_OFFER_NOT_AVAILABLE';
  end if;

  if
    v_offer_amount is null
    or v_offer_amount <= 0
  then
    raise exception
      'KLYX_GROUP_OFFER_PRICE_INVALID';
  end if;

  select
    count(*),
    count(*) filter (
      where budget_max is null
    ),
    coalesce(
      sum(budget_max),
      0
    ),
    coalesce(
      sum(duration_minutes),
      0
    )
  into
    v_slot_count,
    v_null_budget_count,
    v_budget_total,
    v_duration_total
  from public.market_service_request_slots
  where market_request_id =
    p_market_request_id;

  if
    v_slot_count < 2
    or v_slot_count > 20
  then
    raise exception
      'KLYX_GROUP_SLOTS_INVALID';
  end if;

  if v_duration_total <= 0 then
    raise exception
      'KLYX_GROUP_DURATION_INVALID';
  end if;

  v_total_cents :=
    round(
      v_offer_amount * 100
    )::integer;

  if v_total_cents < v_slot_count then
    raise exception
      'KLYX_GROUP_PRICE_TOO_LOW';
  end if;

  v_use_budget :=
    v_null_budget_count = 0
    and v_budget_total > 0;

  insert into public.booking_groups (
    market_request_id,
    client_profile_id,
    provider_profile_id,
    user_service_id,
    offer_id,
    status,
    payment_status,
    total_amount_cents,
    currency,
    slot_count,
    updated_at
  )
  values (
    p_market_request_id,
    p_client_profile_id,
    v_provider_id,
    v_user_service_id,
    p_offer_id,
    'pending_provider',
    'unpaid',
    v_total_cents,
    'EUR',
    v_slot_count,
    now()
  )
  returning id
  into v_group_id;

  for v_slot in
    select
      position,
      requested_date,
      start_time,
      end_time,
      budget_max,
      duration_minutes
    from public.market_service_request_slots
    where market_request_id =
      p_market_request_id
    order by position
  loop
    v_index :=
      v_index + 1;

    if v_slot.end_time <= v_slot.start_time then
      raise exception
        'KLYX_GROUP_OVERNIGHT_NOT_SUPPORTED';
    end if;

    if v_use_budget then
      v_weight :=
        v_slot.budget_max;
    else
      v_weight :=
        v_slot.duration_minutes;
    end if;

    if v_index = v_slot_count then
      v_current_amount :=
        v_total_cents -
        v_allocated;
    else
      if v_use_budget then
        v_current_amount :=
          floor(
            v_total_cents *
            v_weight /
            v_budget_total
          )::integer;
      else
        v_current_amount :=
          floor(
            v_total_cents *
            v_weight /
            v_duration_total
          )::integer;
      end if;

      v_current_amount :=
        greatest(
          1,
          v_current_amount
        );
    end if;

    v_allocated :=
      v_allocated +
      v_current_amount;

    insert into public.bookings (
      parent_id,
      babysitter_id,
      provider_id,
      service_id,
      user_service_id,
      quote_id,
      booking_group_id,
      group_position,
      booking_date,
      start_time,
      end_time,
      message,
      status,
      payment_status,
      service_status,
      pricing_type_snapshot,
      unit_price_cents,
      estimated_amount_cents,
      amount_total,
      currency,
      updated_at
    )
    values (
      p_client_profile_id,
      v_provider_id,
      v_provider_id,
      v_service_id,
      v_user_service_id,
      null,
      v_group_id,
      v_slot.position,
      v_slot.requested_date,
      v_slot.start_time,
      v_slot.end_time,
      'Reservation groupee KLYX.',
      'pending',
      'unpaid',
      'scheduled',
      'fixed',
      v_current_amount,
      v_current_amount,
      v_current_amount,
      'EUR',
      now()
    )
    returning id
    into v_booking_id;

    insert into public.booking_status_events (
      booking_id,
      actor_id,
      previous_status,
      new_status,
      note
    )
    values (
      v_booking_id,
      p_client_profile_id,
      null,
      'pending',
      'Creneau cree depuis une reservation groupee KLYX.'
    );
  end loop;

  update public.market_service_offers
  set
    status = 'accepted',
    updated_at = now()
  where id = p_offer_id
    and request_id =
      p_market_request_id;

  update public.market_service_requests
  set
    status = 'matched',
    accepted_offer_id =
      p_offer_id,
    updated_at = now()
  where id =
    p_market_request_id
    and client_profile_id =
      p_client_profile_id;

  return v_group_id;
end;
$$;

revoke all
on function
public.klyx_create_multi_slot_booking_group(
  uuid,
  uuid,
  uuid
)
from public, anon, authenticated;

grant execute
on function
public.klyx_create_multi_slot_booking_group(
  uuid,
  uuid,
  uuid
)
to service_role;

-- ===========================================================
-- ATOMIC PROVIDER DECISION
-- ===========================================================

create or replace function
public.klyx_provider_group_decision(
  p_group_id uuid,
  p_provider_profile_id uuid,
  p_action text,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group record;
begin
  if p_action not in (
    'accept',
    'reject'
  ) then
    raise exception
      'KLYX_GROUP_ACTION_INVALID';
  end if;

  select
    *
  into
    v_group
  from public.booking_groups
  where id =
    p_group_id
    and provider_profile_id =
      p_provider_profile_id
  for update;

  if not found then
    raise exception
      'KLYX_GROUP_NOT_FOUND';
  end if;

  if v_group.status = 'accepted' then
    return 'accepted';
  end if;

  if v_group.status = 'rejected' then
    return 'rejected';
  end if;

  if v_group.status <>
    'pending_provider'
  then
    raise exception
      'KLYX_GROUP_NOT_PENDING';
  end if;

  if p_action = 'accept' then
    update public.bookings
    set
      status = 'accepted',
      accepted_at = now(),
      provider_response =
        nullif(
          trim(
            coalesce(
              p_note,
              ''
            )
          ),
          ''
        ),
      service_status =
        'scheduled',
      updated_at = now()
    where booking_group_id =
      p_group_id
      and status =
        'pending';

    insert into public.booking_status_events (
      booking_id,
      actor_id,
      previous_status,
      new_status,
      note
    )
    select
      id,
      p_provider_profile_id,
      'pending',
      'accepted',
      coalesce(
        nullif(
          trim(
            coalesce(
              p_note,
              ''
            )
          ),
          ''
        ),
        'Reservation groupee acceptee par le prestataire.'
      )
    from public.bookings
    where booking_group_id =
      p_group_id
      and status =
        'accepted';

    update public.booking_groups
    set
      status =
        'accepted',
      accepted_at =
        now(),
      updated_at =
        now()
    where id =
      p_group_id;

    update public.market_service_offers
    set
      status =
        'rejected',
      updated_at =
        now()
    where request_id =
      v_group.market_request_id
      and id <>
        v_group.offer_id
      and status =
        'sent';

    return 'accepted';
  end if;

  update public.bookings
  set
    status =
      'rejected',
    rejected_at =
      now(),
    provider_response =
      nullif(
        trim(
          coalesce(
            p_note,
            ''
          )
        ),
        ''
      ),
    service_status =
      'cancelled',
    updated_at =
      now()
  where booking_group_id =
    p_group_id
    and status =
      'pending';

  insert into public.booking_status_events (
    booking_id,
    actor_id,
    previous_status,
    new_status,
    note
  )
  select
    id,
    p_provider_profile_id,
    'pending',
    'rejected',
    coalesce(
      nullif(
        trim(
          coalesce(
            p_note,
            ''
          )
        ),
        ''
      ),
      'Reservation groupee refusee par le prestataire.'
    )
  from public.bookings
  where booking_group_id =
    p_group_id
    and status =
      'rejected';

  update public.booking_groups
  set
    status =
      'rejected',
    rejected_at =
      now(),
    updated_at =
      now()
  where id =
    p_group_id;

  update public.market_service_offers
  set
    status =
      'rejected',
    updated_at =
      now()
  where id =
    v_group.offer_id;

  update public.market_service_requests
  set
    status =
      'open',
    accepted_offer_id =
      null,
    updated_at =
      now()
  where id =
    v_group.market_request_id;

  return 'rejected';
end;
$$;

revoke all
on function
public.klyx_provider_group_decision(
  uuid,
  uuid,
  text,
  text
)
from public, anon, authenticated;

grant execute
on function
public.klyx_provider_group_decision(
  uuid,
  uuid,
  text,
  text
)
to service_role;