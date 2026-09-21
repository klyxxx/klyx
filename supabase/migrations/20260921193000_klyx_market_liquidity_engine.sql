-- KLYX universal Market & Liquidity Engine foundation.
--
-- Invariant:
-- technical support != actual market liquidity.
--
-- Country/service/market availability is data. No country or service list in
-- application code is allowed to become the liquidity authority.

begin;

create extension if not exists pgcrypto;

alter table public.market_service_requests
  add column if not exists market_key text,
  add column if not exists region_key text,
  add column if not exists price_band_key text;

create table if not exists public.klyx_market_service_support (
  id uuid primary key default gen_random_uuid(),
  market_key text not null default '*',
  country_code text not null default '*',
  region_key text not null default '*',
  service_id uuid not null references public.services(id) on delete cascade,
  currency_code text not null default '*',
  technical_status text not null default 'unsupported',
  priority integer not null default 0,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  evidence_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint klyx_market_service_support_country_check
    check (country_code = '*' or country_code ~ '^[A-Z]{2}$'),
  constraint klyx_market_service_support_currency_check
    check (currency_code = '*' or currency_code ~ '^[A-Z]{3}$'),
  constraint klyx_market_service_support_status_check
    check (technical_status in ('unsupported', 'experimental', 'supported', 'degraded')),
  constraint klyx_market_service_support_validity_check
    check (valid_until is null or valid_until > valid_from)
);

create index if not exists klyx_market_service_support_lookup_idx
  on public.klyx_market_service_support (
    service_id,
    country_code,
    currency_code,
    priority desc,
    valid_from desc
  );

create unique index if not exists klyx_market_service_support_scope_uidx
  on public.klyx_market_service_support (
    market_key,
    country_code,
    region_key,
    service_id,
    currency_code,
    valid_from
  );

create table if not exists public.klyx_market_liquidity_policies (
  id uuid primary key default gen_random_uuid(),
  market_key text not null default '*',
  country_code text not null default '*',
  region_key text not null default '*',
  service_id uuid references public.services(id) on delete cascade,
  currency_code text not null default '*',
  price_band_key text not null default '*',
  priority integer not null default 0,

  minimum_demand_sample integer not null default 1,
  demand_maturity_seconds integer not null default 0,

  max_time_to_first_match_seconds integer,
  max_time_to_quote_seconds integer,
  min_matching_quality_bps integer,
  min_availability_probability_bps integer,
  min_quote_probability_bps integer,
  min_quote_acceptance_bps integer,
  min_booking_conversion_bps integer,
  min_fill_rate_bps integer,
  min_completion_rate_bps integer,
  max_cancellation_rate_bps integer,
  min_replacement_success_bps integer,
  min_repeat_usage_bps integer,
  min_fulfillment_probability_bps integer,
  min_provider_utilization_bps integer,
  max_provider_utilization_bps integer,

  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  evidence_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint klyx_market_liquidity_policy_country_check
    check (country_code = '*' or country_code ~ '^[A-Z]{2}$'),
  constraint klyx_market_liquidity_policy_currency_check
    check (currency_code = '*' or currency_code ~ '^[A-Z]{3}$'),
  constraint klyx_market_liquidity_policy_sample_check
    check (minimum_demand_sample >= 1),
  constraint klyx_market_liquidity_policy_maturity_check
    check (demand_maturity_seconds >= 0),
  constraint klyx_market_liquidity_policy_time_check
    check (
      (max_time_to_first_match_seconds is null or max_time_to_first_match_seconds >= 0)
      and (max_time_to_quote_seconds is null or max_time_to_quote_seconds >= 0)
    ),
  constraint klyx_market_liquidity_policy_bps_check
    check (
      (min_matching_quality_bps is null or min_matching_quality_bps between 0 and 10000)
      and (min_availability_probability_bps is null or min_availability_probability_bps between 0 and 10000)
      and (min_quote_probability_bps is null or min_quote_probability_bps between 0 and 10000)
      and (min_quote_acceptance_bps is null or min_quote_acceptance_bps between 0 and 10000)
      and (min_booking_conversion_bps is null or min_booking_conversion_bps between 0 and 10000)
      and (min_fill_rate_bps is null or min_fill_rate_bps between 0 and 10000)
      and (min_completion_rate_bps is null or min_completion_rate_bps between 0 and 10000)
      and (max_cancellation_rate_bps is null or max_cancellation_rate_bps between 0 and 10000)
      and (min_replacement_success_bps is null or min_replacement_success_bps between 0 and 10000)
      and (min_repeat_usage_bps is null or min_repeat_usage_bps between 0 and 10000)
      and (min_fulfillment_probability_bps is null or min_fulfillment_probability_bps between 0 and 10000)
      and (min_provider_utilization_bps is null or min_provider_utilization_bps between 0 and 10000)
      and (max_provider_utilization_bps is null or max_provider_utilization_bps between 0 and 10000)
      and (
        min_provider_utilization_bps is null
        or max_provider_utilization_bps is null
        or min_provider_utilization_bps <= max_provider_utilization_bps
      )
    ),
  constraint klyx_market_liquidity_policy_validity_check
    check (valid_until is null or valid_until > valid_from)
);

create index if not exists klyx_market_liquidity_policy_lookup_idx
  on public.klyx_market_liquidity_policies (
    service_id,
    country_code,
    currency_code,
    priority desc,
    valid_from desc
  );

create table if not exists public.klyx_market_geography_rules (
  id uuid primary key default gen_random_uuid(),
  market_key text not null,
  country_code text not null,
  region_key text not null,
  locality_key text not null,
  priority integer not null default 0,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint klyx_market_geography_country_check
    check (country_code ~ '^[A-Z]{2}$'),
  constraint klyx_market_geography_market_check
    check (char_length(trim(market_key)) between 1 and 120),
  constraint klyx_market_geography_region_check
    check (char_length(trim(region_key)) between 1 and 160),
  constraint klyx_market_geography_locality_check
    check (char_length(trim(locality_key)) between 1 and 200),
  constraint klyx_market_geography_validity_check
    check (valid_until is null or valid_until > valid_from)
);

create index if not exists klyx_market_geography_lookup_idx
  on public.klyx_market_geography_rules (
    country_code,
    locality_key,
    priority desc,
    valid_from desc
  );

create table if not exists public.klyx_market_price_bands (
  id uuid primary key default gen_random_uuid(),
  band_key text not null,
  market_key text not null default '*',
  country_code text not null default '*',
  region_key text not null default '*',
  service_id uuid references public.services(id) on delete cascade,
  currency_code text not null default '*',
  min_budget_amount numeric(18,6),
  max_budget_amount numeric(18,6),
  priority integer not null default 0,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint klyx_market_price_band_key_check
    check (band_key ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$'),
  constraint klyx_market_price_band_country_check
    check (country_code = '*' or country_code ~ '^[A-Z]{2}$'),
  constraint klyx_market_price_band_currency_check
    check (currency_code = '*' or currency_code ~ '^[A-Z]{3}$'),
  constraint klyx_market_price_band_amount_check
    check (
      (min_budget_amount is null or min_budget_amount >= 0)
      and (max_budget_amount is null or max_budget_amount > 0)
      and (
        min_budget_amount is null
        or max_budget_amount is null
        or max_budget_amount > min_budget_amount
      )
    ),
  constraint klyx_market_price_band_validity_check
    check (valid_until is null or valid_until > valid_from)
);

create index if not exists klyx_market_price_bands_lookup_idx
  on public.klyx_market_price_bands (
    service_id,
    country_code,
    currency_code,
    priority desc,
    valid_from desc
  );

create table if not exists public.klyx_market_liquidity_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,

  market_key text,
  country_code text,
  region_key text,
  service_id uuid not null references public.services(id) on delete restrict,
  currency_code text,
  price_band_key text,

  request_id uuid references public.market_service_requests(id) on delete set null,
  client_profile_id uuid references public.profiles(id) on delete set null,
  provider_profile_id uuid references public.profiles(id) on delete set null,
  proposal_id uuid,
  booking_id uuid references public.bookings(id) on delete set null,
  incident_id uuid references public.booking_incidents(id) on delete set null,

  score_bps integer,
  capacity_units integer,
  utilized_units integer,

  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint klyx_market_liquidity_event_type_check
    check (
      event_type in (
        'demand_created',
        'request_terminal',
        'match_found',
        'availability_confirmed',
        'quote_created',
        'quote_accepted',
        'booking_created',
        'booking_completed',
        'booking_cancelled',
        'replacement_requested',
        'replacement_succeeded',
        'supply_capacity_observed'
      )
    ),
  constraint klyx_market_liquidity_event_country_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint klyx_market_liquidity_event_currency_check
    check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),
  constraint klyx_market_liquidity_event_score_check
    check (score_bps is null or score_bps between 0 and 10000),
  constraint klyx_market_liquidity_event_capacity_check
    check (
      (capacity_units is null or capacity_units >= 0)
      and (utilized_units is null or utilized_units >= 0)
      and (
        capacity_units is null
        or utilized_units is null
        or utilized_units <= capacity_units
      )
    )
);

create index if not exists klyx_market_liquidity_events_segment_idx
  on public.klyx_market_liquidity_events (
    service_id,
    country_code,
    currency_code,
    occurred_at desc
  );

create index if not exists klyx_market_liquidity_events_request_idx
  on public.klyx_market_liquidity_events (
    request_id,
    occurred_at asc
  )
  where request_id is not null;

create index if not exists klyx_market_liquidity_events_provider_idx
  on public.klyx_market_liquidity_events (
    provider_profile_id,
    occurred_at desc
  )
  where provider_profile_id is not null;

alter table public.klyx_market_service_support enable row level security;
alter table public.klyx_market_liquidity_policies enable row level security;
alter table public.klyx_market_geography_rules enable row level security;
alter table public.klyx_market_price_bands enable row level security;
alter table public.klyx_market_liquidity_events enable row level security;

revoke all privileges on table public.klyx_market_service_support
  from public, anon, authenticated;
revoke all privileges on table public.klyx_market_liquidity_policies
  from public, anon, authenticated;
revoke all privileges on table public.klyx_market_geography_rules
  from public, anon, authenticated;
revoke all privileges on table public.klyx_market_price_bands
  from public, anon, authenticated;
revoke all privileges on table public.klyx_market_liquidity_events
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.klyx_market_service_support
  to service_role;

grant select, insert, update, delete
  on table public.klyx_market_liquidity_policies
  to service_role;

grant select, insert, update, delete
  on table public.klyx_market_geography_rules
  to service_role;

grant select, insert, update, delete
  on table public.klyx_market_price_bands
  to service_role;

-- Liquidity telemetry is append-only from the application point of view.
grant select, insert
  on table public.klyx_market_liquidity_events
  to service_role;

create or replace function public.klyx_classify_market_request_price_band()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_country_code text;
  v_currency_code text;
  v_locality_key text;
  v_market_key text;
  v_region_key text;
begin
  if new.budget_max is null then
    new.price_band_key := null;
    return new;
  end if;

  v_country_code := upper(nullif(trim(new.country_code), ''));
  v_currency_code := upper(nullif(trim(new.currency), ''));

  -- The legacy market snapshot guard remains the authority that validates
  -- country/currency. This fallback only gives the classifier the same context
  -- when trigger ordering runs this classifier first.
  if v_country_code is null or v_currency_code is null then
    select
      upper(nullif(trim(profile.country_code), '')),
      upper(nullif(trim(profile.currency_code), ''))
    into
      v_country_code,
      v_currency_code
    from public.profiles as profile
    where profile.id = new.client_profile_id;
  end if;

  v_locality_key :=
    regexp_replace(
      lower(trim(coalesce(new.city, ''))),
      '[[:space:]]+',
      ' ',
      'g'
    );

  if
    (new.market_key is null or new.region_key is null)
    and v_country_code is not null
    and v_locality_key <> ''
  then
    select
      geography.market_key,
      geography.region_key
    into
      v_market_key,
      v_region_key
    from public.klyx_market_geography_rules as geography
    where
      geography.country_code = v_country_code
      and geography.locality_key = v_locality_key
      and geography.valid_from <= now()
      and (geography.valid_until is null or geography.valid_until > now())
    order by
      geography.priority desc,
      geography.valid_from desc
    limit 1;

    new.market_key := coalesce(new.market_key, v_market_key);
    new.region_key := coalesce(new.region_key, v_region_key);
  end if;

  new.price_band_key := null;

  select band.band_key
  into new.price_band_key
  from public.klyx_market_price_bands as band
  where
    band.valid_from <= now()
    and (band.valid_until is null or band.valid_until > now())
    and (band.market_key = '*' or band.market_key = coalesce(new.market_key, ''))
    and (band.country_code = '*' or band.country_code = coalesce(v_country_code, ''))
    and (band.region_key = '*' or band.region_key = coalesce(new.region_key, ''))
    and (band.service_id is null or band.service_id = new.service_id)
    and (band.currency_code = '*' or band.currency_code = coalesce(v_currency_code, ''))
    and (band.min_budget_amount is null or new.budget_max >= band.min_budget_amount)
    and (band.max_budget_amount is null or new.budget_max < band.max_budget_amount)
  order by
    band.priority desc,
    (
      (band.market_key <> '*')::integer
      + (band.country_code <> '*')::integer
      + (band.region_key <> '*')::integer
      + (band.service_id is not null)::integer
      + (band.currency_code <> '*')::integer
    ) desc,
    band.valid_from desc
  limit 1;

  return new;
end;
$$;

drop trigger if exists klyx_classify_market_request_price_band
  on public.market_service_requests;

create trigger klyx_classify_market_request_price_band
before insert or update of
  city,
  budget_max,
  market_key,
  country_code,
  region_key,
  service_id,
  currency
on public.market_service_requests
for each row
execute function public.klyx_classify_market_request_price_band();

create or replace function public.klyx_insert_market_liquidity_event(
  p_event_key text,
  p_event_type text,
  p_request_id uuid,
  p_provider_profile_id uuid,
  p_proposal_id uuid,
  p_booking_id uuid,
  p_incident_id uuid,
  p_score_bps integer,
  p_capacity_units integer,
  p_utilized_units integer,
  p_occurred_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.market_service_requests%rowtype;
begin
  if p_request_id is null then
    raise exception 'KLYX_LIQUIDITY_REQUEST_REQUIRED'
      using errcode = '22023';
  end if;

  select *
  into v_request
  from public.market_service_requests
  where id = p_request_id;

  if not found then
    raise exception 'KLYX_LIQUIDITY_REQUEST_NOT_FOUND'
      using errcode = '23503';
  end if;

  insert into public.klyx_market_liquidity_events (
    event_key,
    event_type,
    market_key,
    country_code,
    region_key,
    service_id,
    currency_code,
    price_band_key,
    request_id,
    client_profile_id,
    provider_profile_id,
    proposal_id,
    booking_id,
    incident_id,
    score_bps,
    capacity_units,
    utilized_units,
    occurred_at,
    metadata
  )
  values (
    p_event_key,
    p_event_type,
    v_request.market_key,
    upper(v_request.country_code),
    v_request.region_key,
    v_request.service_id,
    upper(v_request.currency),
    v_request.price_band_key,
    v_request.id,
    v_request.client_profile_id,
    p_provider_profile_id,
    p_proposal_id,
    p_booking_id,
    p_incident_id,
    p_score_bps,
    p_capacity_units,
    p_utilized_units,
    coalesce(p_occurred_at, now()),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (event_key)
  do nothing;
end;
$$;

revoke all
on function public.klyx_insert_market_liquidity_event(
  text, text, uuid, uuid, uuid, uuid, uuid, integer, integer, integer, timestamptz, jsonb
)
from public, anon, authenticated;

grant execute
on function public.klyx_insert_market_liquidity_event(
  text, text, uuid, uuid, uuid, uuid, uuid, integer, integer, integer, timestamptz, jsonb
)
to service_role;

create or replace function public.klyx_record_market_supply_capacity_observation(
  p_event_key text,
  p_market_key text,
  p_country_code text,
  p_region_key text,
  p_service_id uuid,
  p_currency_code text,
  p_price_band_key text,
  p_capacity_units integer,
  p_utilized_units integer,
  p_occurred_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_service_id is null
    or p_capacity_units is null
    or p_capacity_units < 0
    or p_utilized_units is null
    or p_utilized_units < 0
    or p_utilized_units > p_capacity_units
  then
    raise exception 'KLYX_LIQUIDITY_CAPACITY_INVALID'
      using errcode = '22023';
  end if;

  insert into public.klyx_market_liquidity_events (
    event_key,
    event_type,
    market_key,
    country_code,
    region_key,
    service_id,
    currency_code,
    price_band_key,
    capacity_units,
    utilized_units,
    occurred_at,
    metadata
  )
  values (
    p_event_key,
    'supply_capacity_observed',
    nullif(trim(p_market_key), ''),
    case
      when nullif(trim(p_country_code), '') is null then null
      else upper(trim(p_country_code))
    end,
    nullif(trim(p_region_key), ''),
    p_service_id,
    case
      when nullif(trim(p_currency_code), '') is null then null
      else upper(trim(p_currency_code))
    end,
    nullif(trim(p_price_band_key), ''),
    p_capacity_units,
    p_utilized_units,
    coalesce(p_occurred_at, now()),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (event_key)
  do nothing;
end;
$$;

revoke all
on function public.klyx_record_market_supply_capacity_observation(
  text, text, text, text, uuid, text, text, integer, integer, timestamptz, jsonb
)
from public, anon, authenticated;

grant execute
on function public.klyx_record_market_supply_capacity_observation(
  text, text, text, text, uuid, text, text, integer, integer, timestamptz, jsonb
)
to service_role;

create or replace function public.klyx_liquidity_request_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.klyx_insert_market_liquidity_event(
      'request:' || new.id::text || ':demand',
      'demand_created',
      new.id,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      new.created_at,
      jsonb_build_object('status', new.status)
    );
    return new;
  end if;

  if old.status is distinct from new.status
    and new.status in ('cancelled', 'closed')
  then
    perform public.klyx_insert_market_liquidity_event(
      'request:' || new.id::text || ':terminal:' || new.status,
      'request_terminal',
      new.id,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      coalesce(new.updated_at, now()),
      jsonb_build_object('status', new.status)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists klyx_liquidity_market_request_trigger
  on public.market_service_requests;

create trigger klyx_liquidity_market_request_trigger
after insert or update of status
on public.market_service_requests
for each row
execute function public.klyx_liquidity_request_trigger();

create or replace function public.klyx_liquidity_candidate_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_score integer;
begin
  v_score :=
    case
      when new.slot_count > 0 then
        least(
          10000,
          greatest(
            0,
            round((new.coverage_count::numeric / new.slot_count::numeric) * 10000)::integer
          )
        )
      else null
    end;

  perform public.klyx_insert_market_liquidity_event(
    'candidate:' || new.id::text || ':match',
    'match_found',
    new.market_request_id,
    new.provider_profile_id,
    null,
    null,
    null,
    v_score,
    null,
    null,
    new.created_at,
    jsonb_build_object(
      'coverage_count', new.coverage_count,
      'slot_count', new.slot_count,
      'full_coverage', new.full_coverage,
      'source', 'market_request_provider_candidates'
    )
  );

  if new.full_coverage then
    perform public.klyx_insert_market_liquidity_event(
      'candidate:' || new.id::text || ':availability',
      'availability_confirmed',
      new.market_request_id,
      new.provider_profile_id,
      null,
      null,
      null,
      v_score,
      null,
      null,
      new.created_at,
      jsonb_build_object(
        'coverage_count', new.coverage_count,
        'slot_count', new.slot_count,
        'source', 'market_request_provider_candidates'
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists klyx_liquidity_candidate_trigger
  on public.market_request_provider_candidates;

create trigger klyx_liquidity_candidate_trigger
after insert
on public.market_request_provider_candidates
for each row
execute function public.klyx_liquidity_candidate_trigger();

create or replace function public.klyx_liquidity_offer_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Quote telemetry never fabricates discovery telemetry. A market can only
    -- claim match/availability when an actual discovery/candidate observation
    -- has been persisted.
    perform public.klyx_insert_market_liquidity_event(
      'offer:' || new.id::text || ':quote',
      'quote_created',
      new.request_id,
      new.provider_profile_id,
      new.id,
      null,
      null,
      null,
      null,
      null,
      new.created_at,
      jsonb_build_object('offer_status', new.status)
    );

    return new;
  end if;

  if old.status is distinct from new.status
    and new.status = 'accepted'
  then
    perform public.klyx_insert_market_liquidity_event(
      'offer:' || new.id::text || ':accepted',
      'quote_accepted',
      new.request_id,
      new.provider_profile_id,
      new.id,
      null,
      null,
      null,
      null,
      null,
      coalesce(new.updated_at, now()),
      '{}'::jsonb
    );
  end if;

  return new;
end;
$$;

drop trigger if exists klyx_liquidity_market_offer_trigger
  on public.market_service_offers;

create trigger klyx_liquidity_market_offer_trigger
after insert or update of status
on public.market_service_offers
for each row
execute function public.klyx_liquidity_offer_trigger();

create or replace function public.klyx_liquidity_booking_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_provider_id uuid;
begin
  -- booking_groups are measured once at the group level. Recording every child
  -- slot would inflate fill/completion for one demand.
  if new.booking_group_id is not null then
    return new;
  end if;

  if new.quote_id is null then
    return new;
  end if;

  select quote.market_request_id
  into v_request_id
  from public.service_quotes as quote
  where quote.id = new.quote_id;

  if v_request_id is null then
    return new;
  end if;

  v_provider_id := coalesce(new.provider_id, new.babysitter_id);

  if tg_op = 'INSERT' then
    perform public.klyx_insert_market_liquidity_event(
      'booking:' || new.id::text || ':created',
      'booking_created',
      v_request_id,
      v_provider_id,
      new.quote_id,
      new.id,
      null,
      null,
      null,
      null,
      new.created_at,
      jsonb_build_object('booking_status', new.status)
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    if new.status = 'completed' then
      perform public.klyx_insert_market_liquidity_event(
        'booking:' || new.id::text || ':completed',
        'booking_completed',
        v_request_id,
        v_provider_id,
        new.quote_id,
        new.id,
        null,
        null,
        null,
        null,
        coalesce(new.completed_at, new.updated_at, now()),
        '{}'::jsonb
      );
    elsif new.status in ('cancelled', 'canceled', 'rejected') then
      perform public.klyx_insert_market_liquidity_event(
        'booking:' || new.id::text || ':cancelled:' || new.status,
        'booking_cancelled',
        v_request_id,
        v_provider_id,
        new.quote_id,
        new.id,
        null,
        null,
        null,
        null,
        coalesce(new.updated_at, now()),
        jsonb_build_object('booking_status', new.status)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists klyx_liquidity_booking_trigger
  on public.bookings;

create trigger klyx_liquidity_booking_trigger
after insert or update of status
on public.bookings
for each row
execute function public.klyx_liquidity_booking_trigger();

create or replace function public.klyx_liquidity_group_booking_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.klyx_insert_market_liquidity_event(
      'booking-group:' || new.id::text || ':created',
      'booking_created',
      new.market_request_id,
      new.provider_profile_id,
      new.offer_id,
      null,
      null,
      null,
      null,
      null,
      new.created_at,
      jsonb_build_object(
        'booking_group_id', new.id,
        'slot_count', new.slot_count,
        'group_status', new.status
      )
    );

    return new;
  end if;

  if old.status is distinct from new.status then
    if new.status = 'completed' then
      perform public.klyx_insert_market_liquidity_event(
        'booking-group:' || new.id::text || ':completed',
        'booking_completed',
        new.market_request_id,
        new.provider_profile_id,
        new.offer_id,
        null,
        null,
        null,
        null,
        null,
        coalesce(new.updated_at, now()),
        jsonb_build_object(
          'booking_group_id', new.id,
          'slot_count', new.slot_count
        )
      );
    elsif new.status in ('cancelled', 'rejected') then
      perform public.klyx_insert_market_liquidity_event(
        'booking-group:' || new.id::text || ':cancelled:' || new.status,
        'booking_cancelled',
        new.market_request_id,
        new.provider_profile_id,
        new.offer_id,
        null,
        null,
        null,
        null,
        null,
        coalesce(new.updated_at, now()),
        jsonb_build_object(
          'booking_group_id', new.id,
          'slot_count', new.slot_count,
          'group_status', new.status
        )
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists klyx_liquidity_group_booking_trigger
  on public.booking_groups;

create trigger klyx_liquidity_group_booking_trigger
after insert or update of status
on public.booking_groups
for each row
execute function public.klyx_liquidity_group_booking_trigger();

create or replace function public.klyx_liquidity_incident_event_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_id uuid;
  v_quote_id uuid;
  v_request_id uuid;
  v_provider_id uuid;
begin
  if new.event_type not in ('replacement_search_started', 'replacement_selected') then
    return new;
  end if;

  select incident.booking_id
  into v_booking_id
  from public.booking_incidents as incident
  where incident.id = new.incident_id;

  if v_booking_id is null then
    return new;
  end if;

  select
    booking.quote_id,
    coalesce(booking.provider_id, booking.babysitter_id)
  into
    v_quote_id,
    v_provider_id
  from public.bookings as booking
  where booking.id = v_booking_id;

  if v_quote_id is null then
    return new;
  end if;

  select quote.market_request_id
  into v_request_id
  from public.service_quotes as quote
  where quote.id = v_quote_id;

  if v_request_id is null then
    return new;
  end if;

  if new.event_type = 'replacement_search_started' then
    perform public.klyx_insert_market_liquidity_event(
      'incident-event:' || new.id::text || ':replacement-requested',
      'replacement_requested',
      v_request_id,
      v_provider_id,
      v_quote_id,
      v_booking_id,
      new.incident_id,
      null,
      null,
      null,
      new.created_at,
      jsonb_build_object(
        'incident_event_id', new.id,
        'semantics', 'replacement_search_started'
      )
    );
  else
    perform public.klyx_insert_market_liquidity_event(
      'incident-event:' || new.id::text || ':replacement-succeeded',
      'replacement_succeeded',
      v_request_id,
      v_provider_id,
      v_quote_id,
      v_booking_id,
      new.incident_id,
      null,
      null,
      null,
      new.created_at,
      jsonb_build_object(
        'incident_event_id', new.id,
        'semantics', 'replacement_selected'
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists klyx_liquidity_incident_event_trigger
  on public.booking_incident_events;

create trigger klyx_liquidity_incident_event_trigger
after insert
on public.booking_incident_events
for each row
execute function public.klyx_liquidity_incident_event_trigger();

comment on table public.klyx_market_service_support is
  'Data-driven technical support authority for a service scope. It does not imply actual market liquidity.';

comment on table public.klyx_market_liquidity_policies is
  'Data-driven liquidity thresholds. Absence of an applicable policy means liquidity is UNKNOWN, never LIQUID.';

comment on table public.klyx_market_geography_rules is
  'Data-driven locality aliases resolving market_key and region_key. Add aliases as data; no country/locality list is an application-code authority.';

comment on table public.klyx_market_price_bands is
  'Data-driven demand price segmentation. No amount threshold is hardcoded in application code.';

comment on table public.klyx_market_liquidity_events is
  'Append-only market telemetry derived from canonical KLYX lifecycle state. It is measurement, not transactional authority.';

notify pgrst, 'reload schema';

commit;
