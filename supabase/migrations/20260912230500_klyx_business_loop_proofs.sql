begin;

-- KLYX_BUSINESS_LOOP_PROOFS_20260912
-- Records only the verified starting condition that canonical transaction tables
-- cannot infer: a real provider had both availability and an income target when
-- sending a real KLYX market offer. Acceptance, booking, completion and payment
-- continue to come from canonical market/booking/ledger tables.

create table if not exists public.business_pilot_income_attempts (
  id uuid primary key default gen_random_uuid(),
  pilot_key text not null,
  provider_profile_id uuid not null references public.profiles(id) on delete cascade,
  market_offer_id uuid not null references public.market_service_offers(id) on delete cascade,
  income_goal_cents integer not null check (income_goal_cents > 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  availability_date date null,
  availability_start time without time zone null,
  availability_end time without time zone null,
  availability_verified boolean not null default false,
  income_goal_verified boolean not null default false,
  note text null,
  enrolled_at timestamptz not null default now(),
  enrolled_by uuid null references auth.users(id) on delete set null,
  constraint business_pilot_income_attempts_offer_unique unique (pilot_key, market_offer_id),
  constraint business_pilot_income_attempts_note_length check (note is null or char_length(note) <= 1000),
  constraint business_pilot_income_attempts_verified_date_check check (
    not availability_verified or availability_date is not null
  ),
  constraint business_pilot_income_attempts_window_check check (
    availability_start is null
    or availability_end is null
    or availability_end > availability_start
  )
);

create index if not exists business_pilot_income_attempts_key_idx
  on public.business_pilot_income_attempts(pilot_key, enrolled_at desc);
create index if not exists business_pilot_income_attempts_provider_idx
  on public.business_pilot_income_attempts(provider_profile_id, enrolled_at desc);

comment on table public.business_pilot_income_attempts is
  'Verified real provider income-intent cohort. The linked offer must already exist; verified availability requires a real availability date. Downstream outcomes are derived from canonical KLYX transaction tables.';

alter table public.business_pilot_income_attempts enable row level security;
revoke all privileges on table public.business_pilot_income_attempts
  from public, anon, authenticated;
grant all privileges on table public.business_pilot_income_attempts
  to service_role;

commit;
