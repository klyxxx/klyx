-- KLYX global money / market policy foundation.
-- Country availability is DATA, never a permanent list embedded in application code.
-- Financial policy tables are server-only and fail closed when no reviewed rule exists.

create extension if not exists pgcrypto;

create table if not exists public.klyx_payment_currency_capabilities (
  provider text not null default 'stripe',
  country_code text not null,
  currency_code text not null,
  charge_enabled boolean not null default false,
  payout_enabled boolean not null default false,
  settlement_enabled boolean not null default false,
  accounting_exponent smallint not null,
  stripe_charge_exponent smallint not null,
  stripe_charge_increment bigint not null default 1,
  stripe_payout_increment bigint not null default 1,
  minimum_charge_amount bigint,
  maximum_charge_amount bigint,
  zero_decimal boolean not null default false,
  source_ref text,
  source_checked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, country_code, currency_code),
  constraint klyx_payment_currency_country_check
    check (country_code ~ '^[A-Z]{2}
    check (currency_code ~ '^[A-Z]{3}$'),
  constraint klyx_payment_currency_exponents_check
    check (
      accounting_exponent between 0 and 6
      and stripe_charge_exponent between 0 and 6
    ),
  constraint klyx_payment_currency_increments_check
    check (
      stripe_charge_increment > 0
      and stripe_payout_increment > 0
    ),
  constraint klyx_payment_currency_charge_bounds_check
    check (
      (minimum_charge_amount is null or minimum_charge_amount > 0)
      and (maximum_charge_amount is null or maximum_charge_amount > 0)
      and (
        minimum_charge_amount is null
        or maximum_charge_amount is null
        or maximum_charge_amount >= minimum_charge_amount
      )
    )
);

create table if not exists public.klyx_market_payment_rules (
  id uuid primary key default gen_random_uuid(),
  payer_country_code text not null default '*',
  execution_country_code text not null,
  service_slug text not null default '*',
  presentment_currency text not null,
  availability_status text not null default 'closed',
  payments_enabled boolean not null default false,
  cross_border_allowed boolean not null default false,
  commission_bps integer not null,
  tax_mode text not null default 'none',
  tax_rate_bps integer not null default 0,
  tax_inclusive boolean not null default false,
  tax_liability text not null default 'provider',
  stripe_tax_code text,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  evidence_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klyx_market_payer_country_check
    check (payer_country_code = '*' or payer_country_code ~ '^[A-Z]{2}$'),
  constraint klyx_market_execution_country_check
    check (execution_country_code ~ '^[A-Z]{2}$'),
  constraint klyx_market_presentment_currency_check
    check (presentment_currency ~ '^[A-Z]{3}$'),
  constraint klyx_market_availability_status_check
    check (availability_status in ('closed', 'pilot', 'open')),
  constraint klyx_market_commission_bps_check
    check (commission_bps between 0 and 10000),
  constraint klyx_market_tax_mode_check
    check (tax_mode in ('none', 'fixed_rate', 'stripe_tax', 'external')),
  constraint klyx_market_tax_rate_bps_check
    check (tax_rate_bps between 0 and 10000),
  constraint klyx_market_tax_liability_check
    check (tax_liability in ('provider', 'platform', 'stripe')),
  constraint klyx_market_validity_check
    check (valid_until is null or valid_until > valid_from),
  unique (
    payer_country_code,
    execution_country_code,
    service_slug,
    presentment_currency,
    valid_from
  )
);

create index if not exists klyx_market_payment_rules_lookup_idx
  on public.klyx_market_payment_rules (
    execution_country_code,
    presentment_currency,
    payer_country_code,
    service_slug,
    valid_from
  );

create table if not exists public.klyx_fx_quotes (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_quote_id text,
  source_currency text not null,
  target_currency text not null,
  source_amount_minor bigint not null,
  target_amount_minor bigint not null,
  lock_expires_at timestamptz not null,
  status text not null default 'usable',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint klyx_fx_source_currency_check
    check (source_currency ~ '^[A-Z]{3}$'),
  constraint klyx_fx_target_currency_check
    check (target_currency ~ '^[A-Z]{3}$'),
  constraint klyx_fx_amounts_check
    check (source_amount_minor > 0 and target_amount_minor > 0),
  constraint klyx_fx_distinct_currency_check
    check (source_currency <> target_currency),
  constraint klyx_fx_status_check
    check (status in ('usable', 'expired', 'consumed', 'revoked'))
);

create unique index if not exists klyx_fx_quotes_provider_quote_uidx
  on public.klyx_fx_quotes (provider, provider_quote_id)
  where provider_quote_id is not null;

alter table public.bookings
  add column if not exists payer_country_code text,
  add column if not exists execution_country_code text,
  add column if not exists presentment_currency text,
  add column if not exists subtotal_amount_minor bigint,
  add column if not exists tax_amount_minor bigint,
  add column if not exists tax_mode text,
  add column if not exists tax_rate_bps integer,
  add column if not exists tax_inclusive boolean,
  add column if not exists tax_liability text,
  add column if not exists stripe_tax_code text,
  add column if not exists commission_bps integer,
  add column if not exists commission_amount_minor bigint,
  add column if not exists total_amount_minor bigint,
  add column if not exists provider_amount_minor bigint,
  add column if not exists market_payment_rule_id uuid,
  add column if not exists fx_quote_id uuid;

create unique index if not exists bookings_fx_quote_unique_idx
  on public.bookings (fx_quote_id)
  where fx_quote_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_payer_country_code_global_check'
  ) then
    alter table public.bookings
      add constraint bookings_payer_country_code_global_check
      check (payer_country_code is null or payer_country_code ~ '^[A-Z]{2}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_execution_country_code_global_check'
  ) then
    alter table public.bookings
      add constraint bookings_execution_country_code_global_check
      check (execution_country_code is null or execution_country_code ~ '^[A-Z]{2}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_presentment_currency_global_check'
  ) then
    alter table public.bookings
      add constraint bookings_presentment_currency_global_check
      check (presentment_currency is null or presentment_currency ~ '^[A-Z]{3}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_global_money_nonnegative_check'
  ) then
    alter table public.bookings
      add constraint bookings_global_money_nonnegative_check
      check (
        (subtotal_amount_minor is null or subtotal_amount_minor >= 0)
        and (tax_amount_minor is null or tax_amount_minor >= 0)
        and (tax_rate_bps is null or tax_rate_bps between 0 and 10000)
        and (tax_mode is null or tax_mode in ('none', 'fixed_rate', 'stripe_tax', 'external'))
        and (tax_liability is null or tax_liability in ('provider', 'platform', 'stripe'))
        and (commission_amount_minor is null or commission_amount_minor >= 0)
        and (total_amount_minor is null or total_amount_minor >= 0)
        and (provider_amount_minor is null or provider_amount_minor >= 0)
        and (commission_bps is null or commission_bps between 0 and 10000)
      );
  end if;
end
$$;


alter table public.booking_financial_ledger
  add column if not exists gross_amount_minor bigint,
  add column if not exists tax_amount_minor bigint,
  add column if not exists commission_amount_minor bigint,
  add column if not exists platform_fee_minor bigint,
  add column if not exists provider_amount_minor bigint,
  add column if not exists refund_amount_minor bigint,
  add column if not exists market_payment_rule_id uuid,
  add column if not exists fx_quote_id uuid;

alter table public.klyx_payment_currency_capabilities enable row level security;
alter table public.klyx_market_payment_rules enable row level security;
alter table public.klyx_fx_quotes enable row level security;

revoke all privileges on table public.klyx_payment_currency_capabilities
  from public, anon, authenticated;
revoke all privileges on table public.klyx_market_payment_rules
  from public, anon, authenticated;
revoke all privileges on table public.klyx_fx_quotes
  from public, anon, authenticated;

grant all privileges on table public.klyx_payment_currency_capabilities
  to service_role;
grant all privileges on table public.klyx_market_payment_rules
  to service_role;
grant all privileges on table public.klyx_fx_quotes
  to service_role;

comment on table public.klyx_market_payment_rules is
  'Data-driven KLYX payer/execution country, currency, commission, tax and availability rules. No row means fail closed; absence never means a permanent product-country limit.';
comment on table public.klyx_payment_currency_capabilities is
  'Reviewed payment-provider currency capabilities and minor-unit rules; refreshed as provider support evolves.';
comment on table public.klyx_fx_quotes is
  'Immutable FX quote truth used for explicit, non-silent currency conversion.';
),
  constraint klyx_payment_currency_code_check
    check (currency_code ~ '^[A-Z]{3}$'),
  constraint klyx_payment_currency_exponents_check
    check (
      accounting_exponent between 0 and 6
      and stripe_charge_exponent between 0 and 6
    ),
  constraint klyx_payment_currency_increments_check
    check (
      stripe_charge_increment > 0
      and stripe_payout_increment > 0
    ),
  constraint klyx_payment_currency_charge_bounds_check
    check (
      (minimum_charge_amount is null or minimum_charge_amount > 0)
      and (maximum_charge_amount is null or maximum_charge_amount > 0)
      and (
        minimum_charge_amount is null
        or maximum_charge_amount is null
        or maximum_charge_amount >= minimum_charge_amount
      )
    )
);

create table if not exists public.klyx_market_payment_rules (
  id uuid primary key default gen_random_uuid(),
  payer_country_code text not null default '*',
  execution_country_code text not null,
  service_slug text not null default '*',
  presentment_currency text not null,
  availability_status text not null default 'closed',
  payments_enabled boolean not null default false,
  cross_border_allowed boolean not null default false,
  commission_bps integer not null,
  tax_mode text not null default 'none',
  tax_rate_bps integer not null default 0,
  tax_inclusive boolean not null default false,
  tax_liability text not null default 'provider',
  stripe_tax_code text,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  evidence_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klyx_market_payer_country_check
    check (payer_country_code = '*' or payer_country_code ~ '^[A-Z]{2}$'),
  constraint klyx_market_execution_country_check
    check (execution_country_code ~ '^[A-Z]{2}$'),
  constraint klyx_market_presentment_currency_check
    check (presentment_currency ~ '^[A-Z]{3}$'),
  constraint klyx_market_availability_status_check
    check (availability_status in ('closed', 'pilot', 'open')),
  constraint klyx_market_commission_bps_check
    check (commission_bps between 0 and 10000),
  constraint klyx_market_tax_mode_check
    check (tax_mode in ('none', 'fixed_rate', 'stripe_tax', 'external')),
  constraint klyx_market_tax_rate_bps_check
    check (tax_rate_bps between 0 and 10000),
  constraint klyx_market_tax_liability_check
    check (tax_liability in ('provider', 'platform', 'stripe')),
  constraint klyx_market_validity_check
    check (valid_until is null or valid_until > valid_from),
  unique (
    payer_country_code,
    execution_country_code,
    service_slug,
    presentment_currency,
    valid_from
  )
);

create index if not exists klyx_market_payment_rules_lookup_idx
  on public.klyx_market_payment_rules (
    execution_country_code,
    presentment_currency,
    payer_country_code,
    service_slug,
    valid_from
  );

create table if not exists public.klyx_fx_quotes (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_quote_id text,
  source_currency text not null,
  target_currency text not null,
  source_amount_minor bigint not null,
  target_amount_minor bigint not null,
  lock_expires_at timestamptz not null,
  status text not null default 'usable',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint klyx_fx_source_currency_check
    check (source_currency ~ '^[A-Z]{3}$'),
  constraint klyx_fx_target_currency_check
    check (target_currency ~ '^[A-Z]{3}$'),
  constraint klyx_fx_amounts_check
    check (source_amount_minor > 0 and target_amount_minor > 0),
  constraint klyx_fx_distinct_currency_check
    check (source_currency <> target_currency),
  constraint klyx_fx_status_check
    check (status in ('usable', 'expired', 'consumed', 'revoked'))
);

create unique index if not exists klyx_fx_quotes_provider_quote_uidx
  on public.klyx_fx_quotes (provider, provider_quote_id)
  where provider_quote_id is not null;

alter table public.bookings
  add column if not exists payer_country_code text,
  add column if not exists execution_country_code text,
  add column if not exists presentment_currency text,
  add column if not exists subtotal_amount_minor bigint,
  add column if not exists tax_amount_minor bigint,
  add column if not exists tax_mode text,
  add column if not exists tax_rate_bps integer,
  add column if not exists tax_inclusive boolean,
  add column if not exists tax_liability text,
  add column if not exists stripe_tax_code text,
  add column if not exists commission_bps integer,
  add column if not exists commission_amount_minor bigint,
  add column if not exists total_amount_minor bigint,
  add column if not exists provider_amount_minor bigint,
  add column if not exists market_payment_rule_id uuid,
  add column if not exists fx_quote_id uuid;

create unique index if not exists bookings_fx_quote_unique_idx
  on public.bookings (fx_quote_id)
  where fx_quote_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_payer_country_code_global_check'
  ) then
    alter table public.bookings
      add constraint bookings_payer_country_code_global_check
      check (payer_country_code is null or payer_country_code ~ '^[A-Z]{2}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_execution_country_code_global_check'
  ) then
    alter table public.bookings
      add constraint bookings_execution_country_code_global_check
      check (execution_country_code is null or execution_country_code ~ '^[A-Z]{2}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_presentment_currency_global_check'
  ) then
    alter table public.bookings
      add constraint bookings_presentment_currency_global_check
      check (presentment_currency is null or presentment_currency ~ '^[A-Z]{3}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_global_money_nonnegative_check'
  ) then
    alter table public.bookings
      add constraint bookings_global_money_nonnegative_check
      check (
        (subtotal_amount_minor is null or subtotal_amount_minor >= 0)
        and (tax_amount_minor is null or tax_amount_minor >= 0)
        and (tax_rate_bps is null or tax_rate_bps between 0 and 10000)
        and (tax_mode is null or tax_mode in ('none', 'fixed_rate', 'stripe_tax', 'external'))
        and (tax_liability is null or tax_liability in ('provider', 'platform', 'stripe'))
        and (commission_amount_minor is null or commission_amount_minor >= 0)
        and (total_amount_minor is null or total_amount_minor >= 0)
        and (provider_amount_minor is null or provider_amount_minor >= 0)
        and (commission_bps is null or commission_bps between 0 and 10000)
      );
  end if;
end
$$;


alter table public.booking_financial_ledger
  add column if not exists gross_amount_minor bigint,
  add column if not exists tax_amount_minor bigint,
  add column if not exists commission_amount_minor bigint,
  add column if not exists platform_fee_minor bigint,
  add column if not exists provider_amount_minor bigint,
  add column if not exists refund_amount_minor bigint,
  add column if not exists market_payment_rule_id uuid,
  add column if not exists fx_quote_id uuid;

alter table public.klyx_payment_currency_capabilities enable row level security;
alter table public.klyx_market_payment_rules enable row level security;
alter table public.klyx_fx_quotes enable row level security;

revoke all privileges on table public.klyx_payment_currency_capabilities
  from public, anon, authenticated;
revoke all privileges on table public.klyx_market_payment_rules
  from public, anon, authenticated;
revoke all privileges on table public.klyx_fx_quotes
  from public, anon, authenticated;

grant all privileges on table public.klyx_payment_currency_capabilities
  to service_role;
grant all privileges on table public.klyx_market_payment_rules
  to service_role;
grant all privileges on table public.klyx_fx_quotes
  to service_role;

comment on table public.klyx_market_payment_rules is
  'Data-driven KLYX payer/execution country, currency, commission, tax and availability rules. No row means fail closed; absence never means a permanent product-country limit.';
comment on table public.klyx_payment_currency_capabilities is
  'Reviewed payment-provider currency capabilities and minor-unit rules; refreshed as provider support evolves.';
comment on table public.klyx_fx_quotes is
  'Immutable FX quote truth used for explicit, non-silent currency conversion.';
