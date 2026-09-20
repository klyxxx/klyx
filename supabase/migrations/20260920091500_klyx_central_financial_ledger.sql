-- KLYX CENTRAL FINANCIAL LEDGER — STRIPE-INDEPENDENT ACCOUNTING TRUTH
--
-- Immutable event journal for:
--   charge -> commission -> provider_liability -> transfer -> reversal -> refund -> payout
--
-- Stripe is evidence, not the accounting authority. Existing
-- booking_financial_ledger remains a compatibility projection/read model.
-- No function in this migration performs a Stripe side effect.
-- Divergence is recorded as reconciliation / human_review; financial truth is
-- never silently overwritten.

begin;

create extension if not exists pgcrypto;

create table if not exists public.financial_reconciliation_cases (
  id uuid primary key default gen_random_uuid(),
  case_key text not null unique,
  booking_id uuid
    references public.bookings(id) on delete restrict,
  dimension text not null,
  reason_code text not null,
  expected jsonb not null default '{}'::jsonb
    check (jsonb_typeof(expected) = 'object'),
  actual jsonb not null default '{}'::jsonb
    check (jsonb_typeof(actual) = 'object'),
  opened_at timestamptz not null default now()
);

create table if not exists public.financial_reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null
    references public.financial_reconciliation_cases(id) on delete restrict,
  event_key text not null unique,
  state text not null
    check (state in ('reconciliation', 'human_review', 'resolved')),
  cause text not null,
  actor_type text not null
    check (actor_type in ('system', 'human')),
  actor_ref text,
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.financial_ledger_events (
  id uuid primary key default gen_random_uuid(),
  movement_key text not null,
  event_key text not null unique,
  movement_type text not null
    check (
      movement_type in (
        'charge',
        'commission',
        'provider_liability',
        'transfer',
        'reversal',
        'refund',
        'payout'
      )
    ),
  amount_minor bigint not null
    check (amount_minor >= 0),
  currency text not null
    check (currency ~ '^[A-Z]{3}$'),
  booking_id uuid not null
    references public.bookings(id) on delete restrict,
  beneficiary_kind text not null
    check (beneficiary_kind in ('platform', 'client', 'provider', 'external')),
  beneficiary_ref text not null,
  stripe_account_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_transfer_id text,
  stripe_transfer_reversal_id text,
  stripe_refund_id text,
  stripe_payout_id text,
  cause text not null,
  source text not null
    check (
      source in (
        'payment_projection',
        'settlement',
        'refund',
        'payout_observation',
        'reconciliation',
        'historical_backfill',
        'manual'
      )
    ),
  previous_state text,
  new_state text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object'),
  payload_hash text not null
);

comment on column public.financial_ledger_events.amount_minor is
  'Canonical KLYX accounting amount in the minor unit of currency. Legacy *_cents fields are compatibility inputs only.';

comment on column public.financial_ledger_events.beneficiary_ref is
  'For client/provider movements this is canonical public.accounts.id text. Profile ids are execution context only; unresolved-profile:* is explicit divergence requiring human review.';

create index if not exists financial_ledger_events_booking_idx
  on public.financial_ledger_events(booking_id, occurred_at desc, recorded_at desc);

create index if not exists financial_ledger_events_movement_idx
  on public.financial_ledger_events(movement_key, occurred_at desc, recorded_at desc);

create index if not exists financial_ledger_events_type_idx
  on public.financial_ledger_events(movement_type, occurred_at desc);

create index if not exists financial_ledger_events_payment_intent_idx
  on public.financial_ledger_events(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index if not exists financial_ledger_events_transfer_idx
  on public.financial_ledger_events(stripe_transfer_id)
  where stripe_transfer_id is not null;

create index if not exists financial_ledger_events_refund_idx
  on public.financial_ledger_events(stripe_refund_id)
  where stripe_refund_id is not null;

create index if not exists financial_reconciliation_cases_booking_idx
  on public.financial_reconciliation_cases(booking_id, opened_at desc);

create index if not exists financial_reconciliation_events_case_idx
  on public.financial_reconciliation_events(case_id, created_at desc);

alter table public.financial_ledger_events enable row level security;
alter table public.financial_reconciliation_cases enable row level security;
alter table public.financial_reconciliation_events enable row level security;

revoke all privileges on table public.financial_ledger_events
  from public, anon, authenticated, service_role;
revoke all privileges on table public.financial_reconciliation_cases
  from public, anon, authenticated, service_role;
revoke all privileges on table public.financial_reconciliation_events
  from public, anon, authenticated, service_role;

grant select on table public.financial_ledger_events to service_role;
grant select on table public.financial_reconciliation_cases to service_role;
grant select on table public.financial_reconciliation_events to service_role;

create or replace function public.klyx_financial_payload_hash(
  p_movement_key text,
  p_event_key text,
  p_movement_type text,
  p_amount_minor bigint,
  p_currency text,
  p_booking_id uuid,
  p_beneficiary_kind text,
  p_beneficiary_ref text,
  p_stripe_account_id text,
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text,
  p_stripe_charge_id text,
  p_stripe_transfer_id text,
  p_stripe_transfer_reversal_id text,
  p_stripe_refund_id text,
  p_stripe_payout_id text,
  p_cause text,
  p_source text,
  p_previous_state text,
  p_new_state text,
  p_occurred_at timestamptz,
  p_details jsonb
)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(
    digest(
      concat_ws(
        '|',
        coalesce(p_movement_key, ''),
        coalesce(p_event_key, ''),
        coalesce(p_movement_type, ''),
        coalesce(p_amount_minor::text, ''),
        coalesce(p_currency, ''),
        coalesce(p_booking_id::text, ''),
        coalesce(p_beneficiary_kind, ''),
        coalesce(p_beneficiary_ref, ''),
        coalesce(p_stripe_account_id, ''),
        coalesce(p_stripe_checkout_session_id, ''),
        coalesce(p_stripe_payment_intent_id, ''),
        coalesce(p_stripe_charge_id, ''),
        coalesce(p_stripe_transfer_id, ''),
        coalesce(p_stripe_transfer_reversal_id, ''),
        coalesce(p_stripe_refund_id, ''),
        coalesce(p_stripe_payout_id, ''),
        coalesce(p_cause, ''),
        coalesce(p_source, ''),
        coalesce(p_previous_state, ''),
        coalesce(p_new_state, ''),
        coalesce(p_occurred_at::text, ''),
        coalesce(p_details, '{}'::jsonb)::text
      ),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.klyx_reject_financial_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'KLYX_FINANCIAL_AUDIT_IMMUTABLE';
end;
$$;

drop trigger if exists financial_ledger_events_immutable
  on public.financial_ledger_events;
create trigger financial_ledger_events_immutable
before update or delete on public.financial_ledger_events
for each row
execute function public.klyx_reject_financial_audit_mutation();

drop trigger if exists financial_reconciliation_cases_immutable
  on public.financial_reconciliation_cases;
create trigger financial_reconciliation_cases_immutable
before update or delete on public.financial_reconciliation_cases
for each row
execute function public.klyx_reject_financial_audit_mutation();

drop trigger if exists financial_reconciliation_events_immutable
  on public.financial_reconciliation_events;
create trigger financial_reconciliation_events_immutable
before update or delete on public.financial_reconciliation_events
for each row
execute function public.klyx_reject_financial_audit_mutation();

create or replace function public.klyx_open_financial_reconciliation_case(
  p_case_key text,
  p_booking_id uuid,
  p_state text,
  p_dimension text,
  p_reason_code text,
  p_expected jsonb default '{}'::jsonb,
  p_actual jsonb default '{}'::jsonb,
  p_cause text default 'financial_truth_divergence'
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_case_id uuid;
  v_event_key text;
begin
  if p_state not in ('reconciliation', 'human_review') then
    raise exception 'KLYX_FINANCIAL_RECONCILIATION_STATE_INVALID';
  end if;

  if coalesce(trim(p_case_key), '') = ''
     or coalesce(trim(p_dimension), '') = ''
     or coalesce(trim(p_reason_code), '') = '' then
    raise exception 'KLYX_FINANCIAL_RECONCILIATION_IDENTITY_REQUIRED';
  end if;

  insert into public.financial_reconciliation_cases (
    case_key,
    booking_id,
    dimension,
    reason_code,
    expected,
    actual
  ) values (
    p_case_key,
    p_booking_id,
    p_dimension,
    p_reason_code,
    coalesce(p_expected, '{}'::jsonb),
    coalesce(p_actual, '{}'::jsonb)
  )
  on conflict (case_key) do nothing;

  select id
    into v_case_id
    from public.financial_reconciliation_cases
   where case_key = p_case_key;

  if v_case_id is null then
    raise exception 'KLYX_FINANCIAL_RECONCILIATION_CASE_NOT_WRITABLE';
  end if;

  v_event_key := concat(
    'case:',
    v_case_id::text,
    ':',
    p_state,
    ':',
    encode(
      digest(
        concat_ws(
          '|',
          p_reason_code,
          coalesce(p_expected, '{}'::jsonb)::text,
          coalesce(p_actual, '{}'::jsonb)::text,
          p_cause
        ),
        'sha256'
      ),
      'hex'
    )
  );

  insert into public.financial_reconciliation_events (
    case_id,
    event_key,
    state,
    cause,
    actor_type,
    details
  ) values (
    v_case_id,
    v_event_key,
    p_state,
    p_cause,
    'system',
    jsonb_build_object(
      'reason_code', p_reason_code,
      'expected', coalesce(p_expected, '{}'::jsonb),
      'actual', coalesce(p_actual, '{}'::jsonb)
    )
  )
  on conflict (event_key) do nothing;

  return v_case_id;
end;
$$;

create or replace function public.klyx_record_financial_reconciliation_decision(
  p_case_id uuid,
  p_event_key text,
  p_state text,
  p_cause text,
  p_actor_ref text,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_existing public.financial_reconciliation_events%rowtype;
  v_conflict_key text;
begin
  if p_state not in ('reconciliation', 'human_review', 'resolved') then
    raise exception 'KLYX_FINANCIAL_RECONCILIATION_STATE_INVALID';
  end if;

  if coalesce(trim(p_event_key), '') = ''
     or coalesce(trim(p_cause), '') = ''
     or coalesce(trim(p_actor_ref), '') = '' then
    raise exception 'KLYX_FINANCIAL_RECONCILIATION_AUDIT_REQUIRED';
  end if;

  insert into public.financial_reconciliation_events (
    case_id,
    event_key,
    state,
    cause,
    actor_type,
    actor_ref,
    details
  ) values (
    p_case_id,
    p_event_key,
    p_state,
    p_cause,
    'human',
    p_actor_ref,
    coalesce(p_details, '{}'::jsonb)
  )
  on conflict (event_key) do nothing
  returning id into v_id;

  if v_id is not null then
    return v_id;
  end if;

  select *
    into v_existing
    from public.financial_reconciliation_events
   where event_key = p_event_key;

  if not found then
    raise exception 'KLYX_FINANCIAL_RECONCILIATION_EVENT_NOT_WRITABLE';
  end if;

  if v_existing.case_id = p_case_id
     and v_existing.state = p_state
     and v_existing.cause = p_cause
     and v_existing.actor_type = 'human'
     and v_existing.actor_ref = p_actor_ref
     and v_existing.details = coalesce(p_details, '{}'::jsonb) then
    return v_existing.id;
  end if;

  v_conflict_key := concat(
    'case:',
    p_case_id::text,
    ':human_review:immutable-reconciliation-event-key-conflict:',
    encode(
      digest(
        concat_ws(
          '|',
          p_event_key,
          v_existing.case_id::text,
          v_existing.state,
          v_existing.cause,
          coalesce(v_existing.actor_ref, ''),
          v_existing.details::text,
          p_case_id::text,
          p_state,
          p_cause,
          p_actor_ref,
          coalesce(p_details, '{}'::jsonb)::text
        ),
        'sha256'
      ),
      'hex'
    )
  );

  insert into public.financial_reconciliation_events (
    case_id,
    event_key,
    state,
    cause,
    actor_type,
    actor_ref,
    details
  ) values (
    p_case_id,
    v_conflict_key,
    'human_review',
    'immutable_reconciliation_event_key_conflict',
    'system',
    null,
    jsonb_build_object(
      'conflicting_event_key', p_event_key,
      'existing', jsonb_build_object(
        'case_id', v_existing.case_id,
        'state', v_existing.state,
        'cause', v_existing.cause,
        'actor_type', v_existing.actor_type,
        'actor_ref', v_existing.actor_ref,
        'details', v_existing.details
      ),
      'incoming', jsonb_build_object(
        'case_id', p_case_id,
        'state', p_state,
        'cause', p_cause,
        'actor_type', 'human',
        'actor_ref', p_actor_ref,
        'details', coalesce(p_details, '{}'::jsonb)
      )
    )
  )
  on conflict (event_key) do nothing
  returning id into v_id;

  if v_id is null then
    select id
      into v_id
      from public.financial_reconciliation_events
     where event_key = v_conflict_key;
  end if;

  if v_id is null then
    raise exception 'KLYX_FINANCIAL_RECONCILIATION_CONFLICT_NOT_WRITABLE';
  end if;

  return v_id;
end;
$$;

create or replace function public.klyx_financial_beneficiary_account_ref(
  p_profile_id uuid,
  p_booking_id uuid,
  p_beneficiary_kind text
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_account_id uuid;
  v_profile_ref text;
begin
  if p_beneficiary_kind not in ('client', 'provider') then
    raise exception 'KLYX_FINANCIAL_BENEFICIARY_KIND_INVALID';
  end if;

  v_profile_ref := coalesce(p_profile_id::text, 'null');

  if p_profile_id is not null then
    select profile.account_id
      into v_account_id
      from public.profiles as profile
     where profile.id = p_profile_id;
  end if;

  if v_account_id is not null then
    return v_account_id::text;
  end if;

  perform public.klyx_open_financial_reconciliation_case(
    concat(
      'central-ledger:beneficiary:',
      coalesce(p_booking_id::text, 'none'),
      ':',
      p_beneficiary_kind,
      ':',
      v_profile_ref
    ),
    p_booking_id,
    'human_review',
    'beneficiary',
    'beneficiary_account_unresolved',
    jsonb_build_object(
      'authority', 'accounts.id',
      'beneficiary_kind', p_beneficiary_kind
    ),
    jsonb_build_object(
      'profile_id', p_profile_id,
      'account_id', null
    ),
    'ledger_beneficiary_resolution'
  );

  return concat('unresolved-profile:', v_profile_ref);
end;
$$;

revoke all on function public.klyx_financial_beneficiary_account_ref(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.klyx_financial_beneficiary_account_ref(uuid, uuid, text)
  to service_role;

create or replace function public.klyx_append_financial_ledger_event(
  p_movement_key text,
  p_event_key text,
  p_movement_type text,
  p_amount_minor bigint,
  p_currency text,
  p_booking_id uuid,
  p_beneficiary_kind text,
  p_beneficiary_ref text,
  p_cause text,
  p_source text,
  p_previous_state text,
  p_new_state text,
  p_occurred_at timestamptz,
  p_stripe_account_id text default null,
  p_stripe_checkout_session_id text default null,
  p_stripe_payment_intent_id text default null,
  p_stripe_charge_id text default null,
  p_stripe_transfer_id text default null,
  p_stripe_transfer_reversal_id text default null,
  p_stripe_refund_id text default null,
  p_stripe_payout_id text default null,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_currency text := upper(trim(coalesce(p_currency, '')));
  v_hash text;
  v_existing public.financial_ledger_events%rowtype;
  v_id uuid;
  v_case_key text;
begin
  if coalesce(trim(p_movement_key), '') = ''
     or coalesce(trim(p_event_key), '') = ''
     or coalesce(trim(p_beneficiary_ref), '') = ''
     or coalesce(trim(p_cause), '') = ''
     or coalesce(trim(p_new_state), '') = '' then
    raise exception 'KLYX_FINANCIAL_LEDGER_IDENTITY_REQUIRED';
  end if;

  if p_amount_minor < 0 then
    raise exception 'KLYX_FINANCIAL_LEDGER_AMOUNT_INVALID';
  end if;

  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'KLYX_FINANCIAL_LEDGER_CURRENCY_INVALID';
  end if;

  if p_occurred_at is null then
    raise exception 'KLYX_FINANCIAL_LEDGER_TIMESTAMP_REQUIRED';
  end if;

  v_hash := public.klyx_financial_payload_hash(
    p_movement_key,
    p_event_key,
    p_movement_type,
    p_amount_minor,
    v_currency,
    p_booking_id,
    p_beneficiary_kind,
    p_beneficiary_ref,
    p_stripe_account_id,
    p_stripe_checkout_session_id,
    p_stripe_payment_intent_id,
    p_stripe_charge_id,
    p_stripe_transfer_id,
    p_stripe_transfer_reversal_id,
    p_stripe_refund_id,
    p_stripe_payout_id,
    p_cause,
    p_source,
    p_previous_state,
    p_new_state,
    p_occurred_at,
    coalesce(p_details, '{}'::jsonb)
  );

  select *
    into v_existing
    from public.financial_ledger_events
   where event_key = p_event_key;

  if found then
    if v_existing.payload_hash = v_hash then
      return v_existing.id;
    end if;

    v_case_key := concat('ledger-event-conflict:', p_event_key);

    perform public.klyx_open_financial_reconciliation_case(
      v_case_key,
      p_booking_id,
      'human_review',
      'ledger',
      'immutable_event_key_conflict',
      jsonb_build_object(
        'event_id', v_existing.id,
        'event_key', v_existing.event_key,
        'payload_hash', v_existing.payload_hash
      ),
      jsonb_build_object(
        'event_key', p_event_key,
        'payload_hash', v_hash
      ),
      'immutable_ledger_conflict'
    );

    -- Persist the divergence, but never report the conflicting append as a
    -- successful idempotent write. The RPC completes so the human-review case
    -- is committed; the server wrapper then fails closed on the NULL result.
    return null;
  end if;

  insert into public.financial_ledger_events (
    movement_key,
    event_key,
    movement_type,
    amount_minor,
    currency,
    booking_id,
    beneficiary_kind,
    beneficiary_ref,
    stripe_account_id,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    stripe_charge_id,
    stripe_transfer_id,
    stripe_transfer_reversal_id,
    stripe_refund_id,
    stripe_payout_id,
    cause,
    source,
    previous_state,
    new_state,
    occurred_at,
    details,
    payload_hash
  ) values (
    p_movement_key,
    p_event_key,
    p_movement_type,
    p_amount_minor,
    v_currency,
    p_booking_id,
    p_beneficiary_kind,
    p_beneficiary_ref,
    p_stripe_account_id,
    p_stripe_checkout_session_id,
    p_stripe_payment_intent_id,
    p_stripe_charge_id,
    p_stripe_transfer_id,
    p_stripe_transfer_reversal_id,
    p_stripe_refund_id,
    p_stripe_payout_id,
    p_cause,
    p_source,
    p_previous_state,
    p_new_state,
    p_occurred_at,
    coalesce(p_details, '{}'::jsonb),
    v_hash
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace view public.financial_ledger_current as
select distinct on (e.movement_key)
  e.*
from public.financial_ledger_events as e
order by
  e.movement_key,
  e.occurred_at desc,
  e.recorded_at desc,
  e.id desc;

create or replace view public.financial_reconciliation_current as
select distinct on (c.id)
  c.id,
  c.case_key,
  c.booking_id,
  c.dimension,
  c.reason_code,
  c.expected,
  c.actual,
  c.opened_at,
  e.state,
  e.cause,
  e.actor_type,
  e.actor_ref,
  e.details,
  e.created_at as state_changed_at
from public.financial_reconciliation_cases as c
join public.financial_reconciliation_events as e
  on e.case_id = c.id
order by
  c.id,
  e.created_at desc,
  e.id desc;

revoke all privileges on table public.financial_ledger_current
  from public, anon, authenticated;
revoke all privileges on table public.financial_reconciliation_current
  from public, anon, authenticated;
grant select on table public.financial_ledger_current to service_role;
grant select on table public.financial_reconciliation_current to service_role;

create or replace function public.klyx_mirror_booking_financial_ledger_to_central()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_provider_id uuid;
  v_identity text;
  v_previous_state text;
  v_occurred_at timestamptz;
  v_provider_amount bigint;
begin
  select
    b.parent_id,
    coalesce(b.provider_id, b.babysitter_id)
    into v_client_id, v_provider_id
    from public.bookings as b
   where b.id = new.booking_id;

  if not found then
    raise exception 'KLYX_FINANCIAL_LEDGER_BOOKING_REQUIRED';
  end if;

  v_identity := coalesce(
    nullif(trim(new.stripe_payment_intent_id), ''),
    nullif(trim(new.stripe_checkout_session_id), ''),
    new.entry_key
  );
  v_previous_state := case when tg_op = 'UPDATE' then old.status else null end;

  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    v_occurred_at := coalesce(
      old.updated_at,
      old.created_at,
      new.created_at,
      now()
    );
  else
    v_occurred_at := coalesce(new.updated_at, new.created_at, now());
  end if;

  v_provider_amount := greatest(coalesce(new.provider_amount_cents, 0), 0);

  if new.entry_type in ('payment_succeeded', 'payment_failed') then
    perform public.klyx_append_financial_ledger_event(
      concat('booking:', new.booking_id, ':charge:', v_identity),
      concat('projection:', new.entry_key, ':charge:', new.status),
      'charge',
      greatest(coalesce(new.gross_amount_cents, 0), 0),
      new.currency,
      new.booking_id,
      'platform',
      'klyx',
      new.entry_type,
      'payment_projection',
      v_previous_state,
      new.status,
      v_occurred_at,
      null,
      new.stripe_checkout_session_id,
      new.stripe_payment_intent_id,
      null,
      null,
      null,
      null,
      null,
      jsonb_build_object('legacy_entry_key', new.entry_key)
    );
  end if;

  if new.entry_type = 'payment_succeeded' and new.status = 'succeeded' then
    perform public.klyx_append_financial_ledger_event(
      concat('booking:', new.booking_id, ':commission:', v_identity),
      concat('projection:', new.entry_key, ':commission:', new.status),
      'commission',
      greatest(coalesce(new.platform_fee_cents, 0), 0),
      new.currency,
      new.booking_id,
      'platform',
      'klyx',
      'payment_commission_recognized',
      'payment_projection',
      v_previous_state,
      'recognized',
      v_occurred_at,
      null,
      new.stripe_checkout_session_id,
      new.stripe_payment_intent_id,
      null,
      null,
      null,
      null,
      null,
      jsonb_build_object('payment_mode', new.payment_mode)
    );

    if v_provider_id is not null then
      perform public.klyx_append_financial_ledger_event(
        concat('booking:', new.booking_id, ':provider-liability:', v_identity),
        concat('projection:', new.entry_key, ':provider-liability:', new.status),
        'provider_liability',
        v_provider_amount,
        new.currency,
        new.booking_id,
        'provider',
        public.klyx_financial_beneficiary_account_ref(v_provider_id, new.booking_id, 'provider'),
        'provider_liability_recognized',
        'payment_projection',
        v_previous_state,
        'recognized',
        v_occurred_at,
        null,
        new.stripe_checkout_session_id,
        new.stripe_payment_intent_id,
        null,
        null,
        null,
        null,
        null,
        jsonb_build_object('payment_mode', new.payment_mode)
      );

      if new.payment_mode in ('connect_destination', 'connect_destination_group', 'connect_destination_split') then
        perform public.klyx_append_financial_ledger_event(
          concat('booking:', new.booking_id, ':transfer:destination:', v_identity),
          concat('projection:', new.entry_key, ':destination-transfer:', new.status),
          'transfer',
          v_provider_amount,
          new.currency,
          new.booking_id,
          'provider',
          public.klyx_financial_beneficiary_account_ref(v_provider_id, new.booking_id, 'provider'),
          'legacy_destination_charge',
          'payment_projection',
          null,
          'succeeded',
          v_occurred_at,
          null,
          new.stripe_checkout_session_id,
          new.stripe_payment_intent_id,
          null,
          null,
          null,
          null,
          null,
          jsonb_build_object('payment_mode', new.payment_mode)
        );

        perform public.klyx_append_financial_ledger_event(
          concat('booking:', new.booking_id, ':provider-liability:', v_identity),
          concat('projection:', new.entry_key, ':provider-liability:discharged'),
          'provider_liability',
          v_provider_amount,
          new.currency,
          new.booking_id,
          'provider',
          public.klyx_financial_beneficiary_account_ref(v_provider_id, new.booking_id, 'provider'),
          'legacy_destination_charge',
          'payment_projection',
          'recognized',
          'discharged',
          v_occurred_at,
          null,
          new.stripe_checkout_session_id,
          new.stripe_payment_intent_id,
          null,
          null,
          null,
          null,
          null,
          jsonb_build_object('payment_mode', new.payment_mode)
        );
      end if;
    end if;
  end if;

  if new.entry_type in ('refund_succeeded', 'refund_failed') then
    perform public.klyx_append_financial_ledger_event(
      concat(
        'booking:',
        new.booking_id,
        ':refund:',
        coalesce(nullif(trim(new.stripe_refund_id), ''), new.entry_key)
      ),
      concat('projection:', new.entry_key, ':refund:', new.status),
      'refund',
      greatest(coalesce(new.refund_amount_cents, 0), 0),
      new.currency,
      new.booking_id,
      'client',
      public.klyx_financial_beneficiary_account_ref(v_client_id, new.booking_id, 'client'),
      new.entry_type,
      'refund',
      v_previous_state,
      new.status,
      v_occurred_at,
      null,
      new.stripe_checkout_session_id,
      new.stripe_payment_intent_id,
      null,
      null,
      null,
      new.stripe_refund_id,
      null,
      jsonb_build_object('payment_mode', new.payment_mode)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists booking_financial_ledger_central_mirror
  on public.booking_financial_ledger;
create trigger booking_financial_ledger_central_mirror
after insert or update on public.booking_financial_ledger
for each row
execute function public.klyx_mirror_booking_financial_ledger_to_central();

create or replace function public.klyx_mirror_booking_settlement_to_central()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid;
  v_payment_identity text;
  v_occurred_at timestamptz := coalesce(new.updated_at, now());
begin
  select coalesce(b.provider_id, b.babysitter_id)
    into v_provider_id
    from public.bookings as b
   where b.id = new.booking_id;

  if v_provider_id is null then
    v_provider_id := new.provider_profile_id;
  end if;

  v_payment_identity := coalesce(
    nullif(trim(new.stripe_payment_intent_id), ''),
    nullif(trim(new.stripe_checkout_session_id), ''),
    new.booking_id::text
  );

  if new.stripe_charge_id is not null
     and (
       tg_op = 'INSERT'
       or old.stripe_charge_id is distinct from new.stripe_charge_id
     ) then
    perform public.klyx_append_financial_ledger_event(
      concat('booking:', new.booking_id, ':charge:', v_payment_identity),
      concat('settlement:', new.booking_id, ':charge:', new.stripe_charge_id),
      'charge',
      greatest(new.gross_amount_cents, 0),
      new.currency,
      new.booking_id,
      'platform',
      'klyx',
      'settlement_charge_truth_observed',
      'settlement',
      case when tg_op = 'UPDATE' then old.state else null end,
      new.state,
      v_occurred_at,
      new.stripe_account_id,
      new.stripe_checkout_session_id,
      new.stripe_payment_intent_id,
      new.stripe_charge_id,
      new.stripe_transfer_id,
      new.stripe_transfer_reversal_id,
      null,
      null,
      '{}'::jsonb
    );
  end if;

  if new.stripe_transfer_id is not null
     and (
       tg_op = 'INSERT'
       or old.stripe_transfer_id is distinct from new.stripe_transfer_id
     ) then
    perform public.klyx_append_financial_ledger_event(
      concat('booking:', new.booking_id, ':transfer:', new.stripe_transfer_id),
      concat('settlement:', new.booking_id, ':transfer:', new.stripe_transfer_id),
      'transfer',
      greatest(new.provider_amount_cents, 0),
      new.currency,
      new.booking_id,
      'provider',
      public.klyx_financial_beneficiary_account_ref(v_provider_id, new.booking_id, 'provider'),
      'settlement_release',
      'settlement',
      case when tg_op = 'UPDATE' then old.state else null end,
      new.state,
      v_occurred_at,
      new.stripe_account_id,
      new.stripe_checkout_session_id,
      new.stripe_payment_intent_id,
      new.stripe_charge_id,
      new.stripe_transfer_id,
      new.stripe_transfer_reversal_id,
      null,
      null,
      jsonb_build_object('transfer_group', new.transfer_group)
    );

    perform public.klyx_append_financial_ledger_event(
      concat('booking:', new.booking_id, ':provider-liability:', v_payment_identity),
      concat('settlement:', new.booking_id, ':provider-liability:released:', new.stripe_transfer_id),
      'provider_liability',
      greatest(new.provider_amount_cents, 0),
      new.currency,
      new.booking_id,
      'provider',
      public.klyx_financial_beneficiary_account_ref(v_provider_id, new.booking_id, 'provider'),
      'settlement_release',
      'settlement',
      'recognized',
      'discharged',
      v_occurred_at,
      new.stripe_account_id,
      new.stripe_checkout_session_id,
      new.stripe_payment_intent_id,
      new.stripe_charge_id,
      new.stripe_transfer_id,
      null,
      null,
      null,
      jsonb_build_object('transfer_group', new.transfer_group)
    );
  end if;

  if new.stripe_transfer_reversal_id is not null
     and (
       tg_op = 'INSERT'
       or old.stripe_transfer_reversal_id is distinct from new.stripe_transfer_reversal_id
     ) then
    perform public.klyx_append_financial_ledger_event(
      concat('booking:', new.booking_id, ':reversal:', new.stripe_transfer_reversal_id),
      concat('settlement:', new.booking_id, ':reversal:', new.stripe_transfer_reversal_id),
      'reversal',
      greatest(new.provider_amount_cents, 0),
      new.currency,
      new.booking_id,
      'platform',
      'klyx',
      'provider_transfer_reversal',
      'settlement',
      case when tg_op = 'UPDATE' then old.state else null end,
      new.state,
      v_occurred_at,
      new.stripe_account_id,
      new.stripe_checkout_session_id,
      new.stripe_payment_intent_id,
      new.stripe_charge_id,
      new.stripe_transfer_id,
      new.stripe_transfer_reversal_id,
      null,
      null,
      jsonb_build_object('transfer_group', new.transfer_group)
    );

    perform public.klyx_append_financial_ledger_event(
      concat('booking:', new.booking_id, ':provider-liability:', v_payment_identity),
      concat('settlement:', new.booking_id, ':provider-liability:reversed:', new.stripe_transfer_reversal_id),
      'provider_liability',
      greatest(new.provider_amount_cents, 0),
      new.currency,
      new.booking_id,
      'provider',
      public.klyx_financial_beneficiary_account_ref(v_provider_id, new.booking_id, 'provider'),
      'provider_transfer_reversal',
      'settlement',
      'discharged',
      'reversed',
      v_occurred_at,
      new.stripe_account_id,
      new.stripe_checkout_session_id,
      new.stripe_payment_intent_id,
      new.stripe_charge_id,
      new.stripe_transfer_id,
      new.stripe_transfer_reversal_id,
      null,
      null,
      jsonb_build_object('transfer_group', new.transfer_group)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists booking_settlements_central_ledger_mirror
  on public.booking_settlements;
create trigger booking_settlements_central_ledger_mirror
after insert or update on public.booking_settlements
for each row
execute function public.klyx_mirror_booking_settlement_to_central();

-- Historical compatibility projection -> immutable central ledger.
insert into public.financial_ledger_events (
  movement_key,
  event_key,
  movement_type,
  amount_minor,
  currency,
  booking_id,
  beneficiary_kind,
  beneficiary_ref,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  stripe_refund_id,
  cause,
  source,
  previous_state,
  new_state,
  occurred_at,
  details,
  payload_hash
)
select
  concat(
    'booking:',
    l.booking_id,
    ':charge:',
    coalesce(
      nullif(trim(l.stripe_payment_intent_id), ''),
      nullif(trim(l.stripe_checkout_session_id), ''),
      l.entry_key
    )
  ),
  concat('backfill:', l.entry_key, ':charge:', l.status),
  'charge',
  greatest(coalesce(l.gross_amount_cents, 0), 0),
  upper(l.currency),
  l.booking_id,
  'platform',
  'klyx',
  l.stripe_checkout_session_id,
  l.stripe_payment_intent_id,
  null,
  l.entry_type,
  'historical_backfill',
  null,
  l.status,
  coalesce(l.updated_at, l.created_at),
  jsonb_build_object('legacy_entry_key', l.entry_key),
  public.klyx_financial_payload_hash(
    concat(
      'booking:',
      l.booking_id,
      ':charge:',
      coalesce(
        nullif(trim(l.stripe_payment_intent_id), ''),
        nullif(trim(l.stripe_checkout_session_id), ''),
        l.entry_key
      )
    ),
    concat('backfill:', l.entry_key, ':charge:', l.status),
    'charge',
    greatest(coalesce(l.gross_amount_cents, 0), 0),
    upper(l.currency),
    l.booking_id,
    'platform',
    'klyx',
    null,
    l.stripe_checkout_session_id,
    l.stripe_payment_intent_id,
    null,
    null,
    null,
    null,
    null,
    l.entry_type,
    'historical_backfill',
    null,
    l.status,
    coalesce(l.updated_at, l.created_at),
    jsonb_build_object('legacy_entry_key', l.entry_key)
  )
from public.booking_financial_ledger as l
where l.entry_type in ('payment_succeeded', 'payment_failed')
on conflict (event_key) do nothing;

insert into public.financial_ledger_events (
  movement_key,
  event_key,
  movement_type,
  amount_minor,
  currency,
  booking_id,
  beneficiary_kind,
  beneficiary_ref,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  cause,
  source,
  previous_state,
  new_state,
  occurred_at,
  details,
  payload_hash
)
select
  concat(
    'booking:',
    l.booking_id,
    ':commission:',
    coalesce(
      nullif(trim(l.stripe_payment_intent_id), ''),
      nullif(trim(l.stripe_checkout_session_id), ''),
      l.entry_key
    )
  ),
  concat('backfill:', l.entry_key, ':commission:succeeded'),
  'commission',
  greatest(coalesce(l.platform_fee_cents, 0), 0),
  upper(l.currency),
  l.booking_id,
  'platform',
  'klyx',
  l.stripe_checkout_session_id,
  l.stripe_payment_intent_id,
  'payment_commission_recognized',
  'historical_backfill',
  null,
  'recognized',
  coalesce(l.updated_at, l.created_at),
  jsonb_build_object('legacy_entry_key', l.entry_key, 'payment_mode', l.payment_mode),
  public.klyx_financial_payload_hash(
    concat(
      'booking:',
      l.booking_id,
      ':commission:',
      coalesce(
        nullif(trim(l.stripe_payment_intent_id), ''),
        nullif(trim(l.stripe_checkout_session_id), ''),
        l.entry_key
      )
    ),
    concat('backfill:', l.entry_key, ':commission:succeeded'),
    'commission',
    greatest(coalesce(l.platform_fee_cents, 0), 0),
    upper(l.currency),
    l.booking_id,
    'platform',
    'klyx',
    null,
    l.stripe_checkout_session_id,
    l.stripe_payment_intent_id,
    null,
    null,
    null,
    null,
    null,
    'payment_commission_recognized',
    'historical_backfill',
    null,
    'recognized',
    coalesce(l.updated_at, l.created_at),
    jsonb_build_object('legacy_entry_key', l.entry_key, 'payment_mode', l.payment_mode)
  )
from public.booking_financial_ledger as l
where l.entry_type = 'payment_succeeded'
  and l.status = 'succeeded'
on conflict (event_key) do nothing;

insert into public.financial_ledger_events (
  movement_key,
  event_key,
  movement_type,
  amount_minor,
  currency,
  booking_id,
  beneficiary_kind,
  beneficiary_ref,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  cause,
  source,
  previous_state,
  new_state,
  occurred_at,
  details,
  payload_hash
)
select
  concat(
    'booking:',
    l.booking_id,
    ':provider-liability:',
    coalesce(
      nullif(trim(l.stripe_payment_intent_id), ''),
      nullif(trim(l.stripe_checkout_session_id), ''),
      l.entry_key
    )
  ),
  concat('backfill:', l.entry_key, ':provider-liability:succeeded'),
  'provider_liability',
  greatest(coalesce(l.provider_amount_cents, 0), 0),
  upper(l.currency),
  l.booking_id,
  'provider',
  public.klyx_financial_beneficiary_account_ref(coalesce(b.provider_id, b.babysitter_id), l.booking_id, 'provider'),
  l.stripe_checkout_session_id,
  l.stripe_payment_intent_id,
  'provider_liability_recognized',
  'historical_backfill',
  null,
  'recognized',
  coalesce(l.updated_at, l.created_at),
  jsonb_build_object('legacy_entry_key', l.entry_key, 'payment_mode', l.payment_mode),
  public.klyx_financial_payload_hash(
    concat(
      'booking:',
      l.booking_id,
      ':provider-liability:',
      coalesce(
        nullif(trim(l.stripe_payment_intent_id), ''),
        nullif(trim(l.stripe_checkout_session_id), ''),
        l.entry_key
      )
    ),
    concat('backfill:', l.entry_key, ':provider-liability:succeeded'),
    'provider_liability',
    greatest(coalesce(l.provider_amount_cents, 0), 0),
    upper(l.currency),
    l.booking_id,
    'provider',
    public.klyx_financial_beneficiary_account_ref(coalesce(b.provider_id, b.babysitter_id), l.booking_id, 'provider'),
    null,
    l.stripe_checkout_session_id,
    l.stripe_payment_intent_id,
    null,
    null,
    null,
    null,
    null,
    'provider_liability_recognized',
    'historical_backfill',
    null,
    'recognized',
    coalesce(l.updated_at, l.created_at),
    jsonb_build_object('legacy_entry_key', l.entry_key, 'payment_mode', l.payment_mode)
  )
from public.booking_financial_ledger as l
join public.bookings as b
  on b.id = l.booking_id
where l.entry_type = 'payment_succeeded'
  and l.status = 'succeeded'
  and coalesce(b.provider_id, b.babysitter_id) is not null
on conflict (event_key) do nothing;

insert into public.financial_ledger_events (
  movement_key,
  event_key,
  movement_type,
  amount_minor,
  currency,
  booking_id,
  beneficiary_kind,
  beneficiary_ref,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  cause,
  source,
  previous_state,
  new_state,
  occurred_at,
  details,
  payload_hash
)
select
  concat(
    'booking:',
    l.booking_id,
    ':transfer:destination:',
    coalesce(
      nullif(trim(l.stripe_payment_intent_id), ''),
      nullif(trim(l.stripe_checkout_session_id), ''),
      l.entry_key
    )
  ),
  concat('backfill:', l.entry_key, ':destination-transfer:succeeded'),
  'transfer',
  greatest(coalesce(l.provider_amount_cents, 0), 0),
  upper(l.currency),
  l.booking_id,
  'provider',
  public.klyx_financial_beneficiary_account_ref(coalesce(b.provider_id, b.babysitter_id), l.booking_id, 'provider'),
  l.stripe_checkout_session_id,
  l.stripe_payment_intent_id,
  'legacy_destination_charge',
  'historical_backfill',
  null,
  'succeeded',
  coalesce(l.updated_at, l.created_at),
  jsonb_build_object('legacy_entry_key', l.entry_key, 'payment_mode', l.payment_mode),
  public.klyx_financial_payload_hash(
    concat(
      'booking:',
      l.booking_id,
      ':transfer:destination:',
      coalesce(
        nullif(trim(l.stripe_payment_intent_id), ''),
        nullif(trim(l.stripe_checkout_session_id), ''),
        l.entry_key
      )
    ),
    concat('backfill:', l.entry_key, ':destination-transfer:succeeded'),
    'transfer',
    greatest(coalesce(l.provider_amount_cents, 0), 0),
    upper(l.currency),
    l.booking_id,
    'provider',
    public.klyx_financial_beneficiary_account_ref(coalesce(b.provider_id, b.babysitter_id), l.booking_id, 'provider'),
    null,
    l.stripe_checkout_session_id,
    l.stripe_payment_intent_id,
    null,
    null,
    null,
    null,
    null,
    'legacy_destination_charge',
    'historical_backfill',
    null,
    'succeeded',
    coalesce(l.updated_at, l.created_at),
    jsonb_build_object('legacy_entry_key', l.entry_key, 'payment_mode', l.payment_mode)
  )
from public.booking_financial_ledger as l
join public.bookings as b
  on b.id = l.booking_id
where l.entry_type = 'payment_succeeded'
  and l.status = 'succeeded'
  and l.payment_mode in (
    'connect_destination',
    'connect_destination_group',
    'connect_destination_split'
  )
  and coalesce(b.provider_id, b.babysitter_id) is not null
on conflict (event_key) do nothing;

insert into public.financial_ledger_events (
  movement_key,
  event_key,
  movement_type,
  amount_minor,
  currency,
  booking_id,
  beneficiary_kind,
  beneficiary_ref,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  cause,
  source,
  previous_state,
  new_state,
  occurred_at,
  details,
  payload_hash
)
select
  concat(
    'booking:',
    l.booking_id,
    ':provider-liability:',
    coalesce(
      nullif(trim(l.stripe_payment_intent_id), ''),
      nullif(trim(l.stripe_checkout_session_id), ''),
      l.entry_key
    )
  ),
  concat('backfill:', l.entry_key, ':provider-liability:discharged'),
  'provider_liability',
  greatest(coalesce(l.provider_amount_cents, 0), 0),
  upper(l.currency),
  l.booking_id,
  'provider',
  public.klyx_financial_beneficiary_account_ref(coalesce(b.provider_id, b.babysitter_id), l.booking_id, 'provider'),
  l.stripe_checkout_session_id,
  l.stripe_payment_intent_id,
  'legacy_destination_charge',
  'historical_backfill',
  'recognized',
  'discharged',
  coalesce(l.updated_at, l.created_at),
  jsonb_build_object('legacy_entry_key', l.entry_key, 'payment_mode', l.payment_mode),
  public.klyx_financial_payload_hash(
    concat(
      'booking:',
      l.booking_id,
      ':provider-liability:',
      coalesce(
        nullif(trim(l.stripe_payment_intent_id), ''),
        nullif(trim(l.stripe_checkout_session_id), ''),
        l.entry_key
      )
    ),
    concat('backfill:', l.entry_key, ':provider-liability:discharged'),
    'provider_liability',
    greatest(coalesce(l.provider_amount_cents, 0), 0),
    upper(l.currency),
    l.booking_id,
    'provider',
    public.klyx_financial_beneficiary_account_ref(coalesce(b.provider_id, b.babysitter_id), l.booking_id, 'provider'),
    null,
    l.stripe_checkout_session_id,
    l.stripe_payment_intent_id,
    null,
    null,
    null,
    null,
    null,
    'legacy_destination_charge',
    'historical_backfill',
    'recognized',
    'discharged',
    coalesce(l.updated_at, l.created_at),
    jsonb_build_object('legacy_entry_key', l.entry_key, 'payment_mode', l.payment_mode)
  )
from public.booking_financial_ledger as l
join public.bookings as b
  on b.id = l.booking_id
where l.entry_type = 'payment_succeeded'
  and l.status = 'succeeded'
  and l.payment_mode in (
    'connect_destination',
    'connect_destination_group',
    'connect_destination_split'
  )
  and coalesce(b.provider_id, b.babysitter_id) is not null
on conflict (event_key) do nothing;

insert into public.financial_ledger_events (
  movement_key,
  event_key,
  movement_type,
  amount_minor,
  currency,
  booking_id,
  beneficiary_kind,
  beneficiary_ref,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  stripe_refund_id,
  cause,
  source,
  previous_state,
  new_state,
  occurred_at,
  details,
  payload_hash
)
select
  concat(
    'booking:',
    l.booking_id,
    ':refund:',
    coalesce(nullif(trim(l.stripe_refund_id), ''), l.entry_key)
  ),
  concat('backfill:', l.entry_key, ':refund:', l.status),
  'refund',
  greatest(coalesce(l.refund_amount_cents, 0), 0),
  upper(l.currency),
  l.booking_id,
  'client',
  public.klyx_financial_beneficiary_account_ref(b.parent_id, l.booking_id, 'client'),
  l.stripe_checkout_session_id,
  l.stripe_payment_intent_id,
  l.stripe_refund_id,
  l.entry_type,
  'historical_backfill',
  null,
  l.status,
  coalesce(l.updated_at, l.created_at),
  jsonb_build_object('legacy_entry_key', l.entry_key, 'payment_mode', l.payment_mode),
  public.klyx_financial_payload_hash(
    concat(
      'booking:',
      l.booking_id,
      ':refund:',
      coalesce(nullif(trim(l.stripe_refund_id), ''), l.entry_key)
    ),
    concat('backfill:', l.entry_key, ':refund:', l.status),
    'refund',
    greatest(coalesce(l.refund_amount_cents, 0), 0),
    upper(l.currency),
    l.booking_id,
    'client',
    public.klyx_financial_beneficiary_account_ref(b.parent_id, l.booking_id, 'client'),
    null,
    l.stripe_checkout_session_id,
    l.stripe_payment_intent_id,
    null,
    null,
    null,
    l.stripe_refund_id,
    null,
    l.entry_type,
    'historical_backfill',
    null,
    l.status,
    coalesce(l.updated_at, l.created_at),
    jsonb_build_object('legacy_entry_key', l.entry_key, 'payment_mode', l.payment_mode)
  )
from public.booking_financial_ledger as l
join public.bookings as b
  on b.id = l.booking_id
where l.entry_type in ('refund_succeeded', 'refund_failed')
on conflict (event_key) do nothing;

insert into public.financial_ledger_events (
  movement_key,
  event_key,
  movement_type,
  amount_minor,
  currency,
  booking_id,
  beneficiary_kind,
  beneficiary_ref,
  stripe_account_id,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  stripe_charge_id,
  stripe_transfer_id,
  stripe_transfer_reversal_id,
  cause,
  source,
  previous_state,
  new_state,
  occurred_at,
  details,
  payload_hash
)
select
  concat(
    'booking:',
    s.booking_id,
    ':charge:',
    coalesce(
      nullif(trim(s.stripe_payment_intent_id), ''),
      nullif(trim(s.stripe_checkout_session_id), ''),
      s.booking_id::text
    )
  ),
  concat('backfill:settlement:', s.booking_id, ':charge:', s.stripe_charge_id),
  'charge',
  greatest(s.gross_amount_cents, 0),
  s.currency,
  s.booking_id,
  'platform',
  'klyx',
  s.stripe_account_id,
  s.stripe_checkout_session_id,
  s.stripe_payment_intent_id,
  s.stripe_charge_id,
  s.stripe_transfer_id,
  s.stripe_transfer_reversal_id,
  'settlement_charge_truth_observed',
  'historical_backfill',
  null,
  s.state,
  coalesce(s.updated_at, s.created_at),
  jsonb_build_object('transfer_group', s.transfer_group),
  public.klyx_financial_payload_hash(
    concat(
      'booking:',
      s.booking_id,
      ':charge:',
      coalesce(
        nullif(trim(s.stripe_payment_intent_id), ''),
        nullif(trim(s.stripe_checkout_session_id), ''),
        s.booking_id::text
      )
    ),
    concat('backfill:settlement:', s.booking_id, ':charge:', s.stripe_charge_id),
    'charge',
    greatest(s.gross_amount_cents, 0),
    s.currency,
    s.booking_id,
    'platform',
    'klyx',
    s.stripe_account_id,
    s.stripe_checkout_session_id,
    s.stripe_payment_intent_id,
    s.stripe_charge_id,
    s.stripe_transfer_id,
    s.stripe_transfer_reversal_id,
    null,
    null,
    'settlement_charge_truth_observed',
    'historical_backfill',
    null,
    s.state,
    coalesce(s.updated_at, s.created_at),
    jsonb_build_object('transfer_group', s.transfer_group)
  )
from public.booking_settlements as s
where s.stripe_charge_id is not null
on conflict (event_key) do nothing;

insert into public.financial_ledger_events (
  movement_key,
  event_key,
  movement_type,
  amount_minor,
  currency,
  booking_id,
  beneficiary_kind,
  beneficiary_ref,
  stripe_account_id,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  stripe_charge_id,
  stripe_transfer_id,
  stripe_transfer_reversal_id,
  cause,
  source,
  previous_state,
  new_state,
  occurred_at,
  details,
  payload_hash
)
select
  concat('booking:', s.booking_id, ':transfer:', s.stripe_transfer_id),
  concat('backfill:settlement:', s.booking_id, ':transfer:', s.stripe_transfer_id),
  'transfer',
  greatest(s.provider_amount_cents, 0),
  s.currency,
  s.booking_id,
  'provider',
  public.klyx_financial_beneficiary_account_ref(s.provider_profile_id, s.booking_id, 'provider'),
  s.stripe_account_id,
  s.stripe_checkout_session_id,
  s.stripe_payment_intent_id,
  s.stripe_charge_id,
  s.stripe_transfer_id,
  s.stripe_transfer_reversal_id,
  'settlement_release',
  'historical_backfill',
  null,
  s.state,
  coalesce(s.released_at, s.updated_at, s.created_at),
  jsonb_build_object('transfer_group', s.transfer_group),
  public.klyx_financial_payload_hash(
    concat('booking:', s.booking_id, ':transfer:', s.stripe_transfer_id),
    concat('backfill:settlement:', s.booking_id, ':transfer:', s.stripe_transfer_id),
    'transfer',
    greatest(s.provider_amount_cents, 0),
    s.currency,
    s.booking_id,
    'provider',
    public.klyx_financial_beneficiary_account_ref(s.provider_profile_id, s.booking_id, 'provider'),
    s.stripe_account_id,
    s.stripe_checkout_session_id,
    s.stripe_payment_intent_id,
    s.stripe_charge_id,
    s.stripe_transfer_id,
    s.stripe_transfer_reversal_id,
    null,
    null,
    'settlement_release',
    'historical_backfill',
    null,
    s.state,
    coalesce(s.released_at, s.updated_at, s.created_at),
    jsonb_build_object('transfer_group', s.transfer_group)
  )
from public.booking_settlements as s
where s.stripe_transfer_id is not null
on conflict (event_key) do nothing;

insert into public.financial_ledger_events (
  movement_key,
  event_key,
  movement_type,
  amount_minor,
  currency,
  booking_id,
  beneficiary_kind,
  beneficiary_ref,
  stripe_account_id,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  stripe_charge_id,
  stripe_transfer_id,
  stripe_transfer_reversal_id,
  cause,
  source,
  previous_state,
  new_state,
  occurred_at,
  details,
  payload_hash
)
select
  concat('booking:', s.booking_id, ':reversal:', s.stripe_transfer_reversal_id),
  concat('backfill:settlement:', s.booking_id, ':reversal:', s.stripe_transfer_reversal_id),
  'reversal',
  greatest(s.provider_amount_cents, 0),
  s.currency,
  s.booking_id,
  'platform',
  'klyx',
  s.stripe_account_id,
  s.stripe_checkout_session_id,
  s.stripe_payment_intent_id,
  s.stripe_charge_id,
  s.stripe_transfer_id,
  s.stripe_transfer_reversal_id,
  'provider_transfer_reversal',
  'historical_backfill',
  null,
  s.state,
  coalesce(s.transfer_reversed_at, s.updated_at, s.created_at),
  jsonb_build_object('transfer_group', s.transfer_group),
  public.klyx_financial_payload_hash(
    concat('booking:', s.booking_id, ':reversal:', s.stripe_transfer_reversal_id),
    concat('backfill:settlement:', s.booking_id, ':reversal:', s.stripe_transfer_reversal_id),
    'reversal',
    greatest(s.provider_amount_cents, 0),
    s.currency,
    s.booking_id,
    'platform',
    'klyx',
    s.stripe_account_id,
    s.stripe_checkout_session_id,
    s.stripe_payment_intent_id,
    s.stripe_charge_id,
    s.stripe_transfer_id,
    s.stripe_transfer_reversal_id,
    null,
    null,
    'provider_transfer_reversal',
    'historical_backfill',
    null,
    s.state,
    coalesce(s.transfer_reversed_at, s.updated_at, s.created_at),
    jsonb_build_object('transfer_group', s.transfer_group)
  )
from public.booking_settlements as s
where s.stripe_transfer_reversal_id is not null
on conflict (event_key) do nothing;

revoke all on function public.klyx_financial_payload_hash(
  text, text, text, bigint, text, uuid, text, text,
  text, text, text, text, text, text, text, text,
  text, text, text, text, timestamptz, jsonb
) from public, anon, authenticated;

revoke all on function public.klyx_open_financial_reconciliation_case(
  text, uuid, text, text, text, jsonb, jsonb, text
) from public, anon, authenticated;

revoke all on function public.klyx_record_financial_reconciliation_decision(
  uuid, text, text, text, text, jsonb
) from public, anon, authenticated;

revoke all on function public.klyx_append_financial_ledger_event(
  text, text, text, bigint, text, uuid, text, text, text, text, text, text,
  timestamptz, text, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.klyx_open_financial_reconciliation_case(
  text, uuid, text, text, text, jsonb, jsonb, text
) to service_role;

grant execute on function public.klyx_record_financial_reconciliation_decision(
  uuid, text, text, text, text, jsonb
) to service_role;

grant execute on function public.klyx_append_financial_ledger_event(
  text, text, text, bigint, text, uuid, text, text, text, text, text, text,
  timestamptz, text, text, text, text, text, text, text, text, jsonb
) to service_role;

comment on table public.financial_ledger_events is
  'Canonical append-only KLYX financial movement journal. Stripe object IDs are evidence; rows are immutable and never silently corrected.';

comment on table public.financial_reconciliation_cases is
  'Immutable identity and initial evidence for a financial divergence between KLYX ledger, Stripe and settlement truth.';

comment on table public.financial_reconciliation_events is
  'Append-only reconciliation/human-review decisions. Resolution never rewrites historical financial events.';

commit;
