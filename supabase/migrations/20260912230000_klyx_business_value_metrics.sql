begin;

-- KLYX_BUSINESS_VALUE_METRICS_20260912
-- Founder-only/server-only accounting inputs for real unit economics.
-- Transaction truth stays in bookings + booking_financial_ledger.

create table if not exists public.business_cost_tracking_state (
  cost_type text primary key
    check (cost_type in ('stripe_fee', 'support', 'fraud_dispute', 'acquisition')),
  tracking_mode text not null
    check (tracking_mode in ('unavailable', 'manual', 'automated')),
  note text null,
  updated_at timestamptz not null default now()
);

insert into public.business_cost_tracking_state (cost_type, tracking_mode, note)
values
  ('stripe_fee', 'manual', 'Record actual Stripe processing fees only; never infer a fee from a percentage.'),
  ('support', 'manual', 'Record actual or explicitly valued support cost for the pilot.'),
  ('fraud_dispute', 'manual', 'Record only realized fraud, chargeback or dispute cost.'),
  ('acquisition', 'unavailable', 'Keep CAC unavailable until paid acquisition is actually used and attributable.')
on conflict (cost_type) do nothing;

create table if not exists public.business_cost_events (
  id uuid primary key default gen_random_uuid(),
  cost_type text not null
    references public.business_cost_tracking_state(cost_type) on delete restrict,
  amount_cents integer not null,
  currency text not null default 'EUR'
    check (currency ~ '^[A-Z]{3}$'),
  service_id uuid null references public.services(id) on delete set null,
  booking_id uuid null references public.bookings(id) on delete set null,
  market_request_id uuid null references public.market_service_requests(id) on delete set null,
  source text not null default 'founder_manual'
    check (source in ('founder_manual', 'stripe', 'support', 'fraud', 'acquisition', 'import')),
  source_key text null,
  note text null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint business_cost_events_source_key_unique unique (source_key),
  constraint business_cost_events_amount_check check (
    amount_cents > 0
    or (amount_cents = 0 and cost_type = 'stripe_fee' and source = 'stripe')
  ),
  constraint business_cost_events_note_length check (note is null or char_length(note) <= 1000)
);

create index if not exists business_cost_events_occurred_idx
  on public.business_cost_events(occurred_at desc);
create index if not exists business_cost_events_type_idx
  on public.business_cost_events(cost_type, occurred_at desc);
create index if not exists business_cost_events_service_idx
  on public.business_cost_events(service_id, occurred_at desc);
create index if not exists business_cost_events_booking_idx
  on public.business_cost_events(booking_id);

create table if not exists public.business_pilot_requests (
  id uuid primary key default gen_random_uuid(),
  pilot_key text not null,
  market_request_id uuid not null
    references public.market_service_requests(id) on delete cascade,
  zone_verified boolean not null default false,
  service_verified boolean not null default false,
  note text null,
  enrolled_at timestamptz not null default now(),
  enrolled_by uuid null references auth.users(id) on delete set null,
  constraint business_pilot_requests_unique unique (pilot_key, market_request_id),
  constraint business_pilot_requests_note_length check (note is null or char_length(note) <= 1000)
);

create index if not exists business_pilot_requests_key_idx
  on public.business_pilot_requests(pilot_key, enrolled_at desc);

comment on table public.business_cost_events is
  'Server-only realized cost ledger used to estimate KLYX unit economics without inventing missing costs. Zero is allowed only for an actual Stripe fee synchronized from Stripe.';
comment on table public.business_cost_tracking_state is
  'Declares whether each cost family is unavailable, manually tracked or automated so zero is never confused with missing data.';
comment on table public.business_pilot_requests is
  'Explicit real-request cohort for tightly scoped local pilots. No precise address is stored here.';

alter table public.business_cost_tracking_state enable row level security;
alter table public.business_cost_events enable row level security;
alter table public.business_pilot_requests enable row level security;

revoke all privileges on table public.business_cost_tracking_state
  from public, anon, authenticated;
revoke all privileges on table public.business_cost_events
  from public, anon, authenticated;
revoke all privileges on table public.business_pilot_requests
  from public, anon, authenticated;

grant all privileges on table public.business_cost_tracking_state to service_role;
grant all privileges on table public.business_cost_events to service_role;
grant all privileges on table public.business_pilot_requests to service_role;

commit;
