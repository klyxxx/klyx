begin;

-- Mission 19 — Market & Liquidity Engine
--
-- Technical support and actual market liquidity are distinct.
-- No country, region, service category, currency, price band or market is
-- embedded in application code as a permanent allow-list.
-- Policies are data. Liquidity metrics remain derived from canonical domain
-- truth and never replace request, quote, booking or incident state.

alter table public.market_service_requests
  add column if not exists market_id text,
  add column if not exists region_id text;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'market_service_requests_market_id_format_check'
  ) then
    alter table public.market_service_requests
      add constraint market_service_requests_market_id_format_check
      check (
        market_id is null
        or (
          length(market_id) between 1 and 128
          and market_id ~ '^[A-Za-z0-9_.:-]+$'
        )
      );
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'market_service_requests_region_id_format_check'
  ) then
    alter table public.market_service_requests
      add constraint market_service_requests_region_id_format_check
      check (
        region_id is null
        or (
          length(region_id) between 1 and 128
          and region_id ~ '^[A-Za-z0-9_.:-]+$'
        )
      );
  end if;
end
$$;

create index if not exists market_service_requests_liquidity_scope_idx
  on public.market_service_requests (
    market_id,
    region_id,
    country_code,
    service_id,
    currency,
    created_at desc
  );

create table if not exists public.klyx_market_service_capabilities (
  id uuid primary key default gen_random_uuid(),
  market_id text not null default '*',
  country_code text not null default '*',
  region_id text not null default '*',
  service_id uuid references public.services(id) on delete restrict,
  capability_status text not null default 'unsupported',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  evidence_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint klyx_market_service_capability_market_check
    check (market_id = '*' or (length(market_id) between 1 and 128 and market_id ~ '^[A-Za-z0-9_.:-]+$')),
  constraint klyx_market_service_capability_country_check
    check (country_code = '*' or country_code ~ '^[A-Z]{2}$'),
  constraint klyx_market_service_capability_region_check
    check (region_id = '*' or (length(region_id) between 1 and 128 and region_id ~ '^[A-Za-z0-9_.:-]+$')),
  constraint klyx_market_service_capability_status_check
    check (capability_status in ('unsupported', 'pilot', 'supported')),
  constraint klyx_market_service_capability_validity_check
    check (valid_until is null or valid_until > valid_from)
);

create unique index if not exists klyx_market_service_capabilities_version_uidx
  on public.klyx_market_service_capabilities (
    market_id,
    country_code,
    region_id,
    coalesce(service_id, '00000000-0000-0000-0000-000000000000'::uuid),
    valid_from
  );

create index if not exists klyx_market_service_capabilities_lookup_idx
  on public.klyx_market_service_capabilities (
    market_id,
    country_code,
    region_id,
    service_id,
    valid_from desc
  );

create table if not exists public.klyx_market_liquidity_price_bands (
  id uuid primary key default gen_random_uuid(),
  band_key text not null,
  market_id text not null default '*',
  country_code text not null default '*',
  region_id text not null default '*',
  service_id uuid references public.services(id) on delete restrict,
  currency_code text not null,
  min_amount_minor bigint not null default 0,
  max_amount_minor bigint,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  evidence_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint klyx_market_liquidity_band_key_check
    check (length(band_key) between 1 and 128 and band_key ~ '^[A-Za-z0-9_.:-]+$'),
  constraint klyx_market_liquidity_band_market_check
    check (market_id = '*' or (length(market_id) between 1 and 128 and market_id ~ '^[A-Za-z0-9_.:-]+$')),
  constraint klyx_market_liquidity_band_country_check
    check (country_code = '*' or country_code ~ '^[A-Z]{2}$'),
  constraint klyx_market_liquidity_band_region_check
    check (region_id = '*' or (length(region_id) between 1 and 128 and region_id ~ '^[A-Za-z0-9_.:-]+$')),
  constraint klyx_market_liquidity_band_currency_check
    check (currency_code ~ '^[A-Z]{3}$'),
  constraint klyx_market_liquidity_band_amount_check
    check (
      min_amount_minor >= 0
      and (max_amount_minor is null or max_amount_minor > min_amount_minor)
    ),
  constraint klyx_market_liquidity_band_validity_check
    check (valid_until is null or valid_until > valid_from)
);

create unique index if not exists klyx_market_liquidity_price_bands_version_uidx
  on public.klyx_market_liquidity_price_bands (
    band_key,
    market_id,
    country_code,
    region_id,
    coalesce(service_id, '00000000-0000-0000-0000-000000000000'::uuid),
    currency_code,
    valid_from
  );

create table if not exists public.klyx_market_liquidity_policies (
  id uuid primary key default gen_random_uuid(),
  market_id text not null default '*',
  country_code text not null default '*',
  region_id text not null default '*',
  service_id uuid references public.services(id) on delete restrict,
  currency_code text not null default '*',
  price_band_key text not null default '*',

  min_sample_size integer not null default 20,
  max_time_to_first_match_seconds integer,
  max_time_to_quote_seconds integer,
  min_quote_acceptance_bps integer,
  min_booking_conversion_bps integer,
  min_fill_rate_bps integer,
  min_completion_rate_bps integer,
  max_cancellation_rate_bps integer,
  min_replacement_success_bps integer,
  min_repeat_usage_bps integer,
  min_provider_utilization_bps integer,
  min_availability_bps integer,
  min_matching_quality_bps integer,

  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  evidence_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint klyx_market_liquidity_policy_market_check
    check (market_id = '*' or (length(market_id) between 1 and 128 and market_id ~ '^[A-Za-z0-9_.:-]+$')),
  constraint klyx_market_liquidity_policy_country_check
    check (country_code = '*' or country_code ~ '^[A-Z]{2}$'),
  constraint klyx_market_liquidity_policy_region_check
    check (region_id = '*' or (length(region_id) between 1 and 128 and region_id ~ '^[A-Za-z0-9_.:-]+$')),
  constraint klyx_market_liquidity_policy_currency_check
    check (currency_code = '*' or currency_code ~ '^[A-Z]{3}$'),
  constraint klyx_market_liquidity_policy_band_check
    check (price_band_key = '*' or (length(price_band_key) between 1 and 128 and price_band_key ~ '^[A-Za-z0-9_.:-]+$')),
  constraint klyx_market_liquidity_policy_sample_check
    check (min_sample_size between 1 and 1000000),
  constraint klyx_market_liquidity_policy_time_check
    check (
      (max_time_to_first_match_seconds is null or max_time_to_first_match_seconds > 0)
      and (max_time_to_quote_seconds is null or max_time_to_quote_seconds > 0)
    ),
  constraint klyx_market_liquidity_policy_rates_check
    check (
      (min_quote_acceptance_bps is null or min_quote_acceptance_bps between 0 and 10000)
      and (min_booking_conversion_bps is null or min_booking_conversion_bps between 0 and 10000)
      and (min_fill_rate_bps is null or min_fill_rate_bps between 0 and 10000)
      and (min_completion_rate_bps is null or min_completion_rate_bps between 0 and 10000)
      and (max_cancellation_rate_bps is null or max_cancellation_rate_bps between 0 and 10000)
      and (min_replacement_success_bps is null or min_replacement_success_bps between 0 and 10000)
      and (min_repeat_usage_bps is null or min_repeat_usage_bps between 0 and 10000)
      and (min_provider_utilization_bps is null or min_provider_utilization_bps between 0 and 10000)
      and (min_availability_bps is null or min_availability_bps between 0 and 10000)
      and (min_matching_quality_bps is null or min_matching_quality_bps between 0 and 10000)
    ),
  constraint klyx_market_liquidity_policy_threshold_required_check
    check (
      max_time_to_first_match_seconds is not null
      or max_time_to_quote_seconds is not null
      or min_quote_acceptance_bps is not null
      or min_booking_conversion_bps is not null
      or min_fill_rate_bps is not null
      or min_completion_rate_bps is not null
      or max_cancellation_rate_bps is not null
      or min_replacement_success_bps is not null
      or min_repeat_usage_bps is not null
      or min_provider_utilization_bps is not null
      or min_availability_bps is not null
      or min_matching_quality_bps is not null
    ),
  constraint klyx_market_liquidity_policy_validity_check
    check (valid_until is null or valid_until > valid_from)
);

create unique index if not exists klyx_market_liquidity_policies_version_uidx
  on public.klyx_market_liquidity_policies (
    market_id,
    country_code,
    region_id,
    coalesce(service_id, '00000000-0000-0000-0000-000000000000'::uuid),
    currency_code,
    price_band_key,
    valid_from
  );

create index if not exists klyx_market_liquidity_policies_lookup_idx
  on public.klyx_market_liquidity_policies (
    market_id,
    country_code,
    region_id,
    service_id,
    currency_code,
    price_band_key,
    valid_from desc
  );

alter table public.klyx_market_service_capabilities enable row level security;
alter table public.klyx_market_liquidity_price_bands enable row level security;
alter table public.klyx_market_liquidity_policies enable row level security;

revoke all privileges on table public.klyx_market_service_capabilities
  from public, anon, authenticated, service_role;
revoke all privileges on table public.klyx_market_liquidity_price_bands
  from public, anon, authenticated, service_role;
revoke all privileges on table public.klyx_market_liquidity_policies
  from public, anon, authenticated, service_role;

grant select on table public.klyx_market_service_capabilities to service_role;
grant select on table public.klyx_market_liquidity_price_bands to service_role;
grant select on table public.klyx_market_liquidity_policies to service_role;

comment on table public.klyx_market_service_capabilities is
  'Data-driven declaration of technical service support. This is distinct from observed liquidity.';
comment on table public.klyx_market_liquidity_price_bands is
  'Versioned, data-driven price segmentation in canonical accounting minor units.';
comment on table public.klyx_market_liquidity_policies is
  'Versioned thresholds used to classify observed liquidity. No market is liquid merely because it is technically supported.';

commit;
