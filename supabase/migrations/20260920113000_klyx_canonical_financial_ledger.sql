-- KLYX CANONICAL FINANCIAL LEDGER — MISSION 8
--
-- Canonical KLYX accounting truth, independent from Stripe as authority.
-- Stripe object ids are external evidence only.
--
-- Invariants:
-- - append-only financial movements;
-- - deterministic idempotency by event_key;
-- - immutable tamper-evident hash chain;
-- - no UPDATE/DELETE correction of ledger truth;
-- - divergence is recorded as reconciliation / human_review, never auto-fixed;
-- - service_role can read ledger tables but can write only through guarded RPCs.

begin;

create extension if not exists pgcrypto;

create table if not exists public.financial_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  sequence_id bigint generated always as identity unique,
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
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null
    check (currency ~ '^[A-Z]{3}$'),
  booking_id uuid references public.bookings(id) on delete restrict,
  booking_ids jsonb not null default '[]'::jsonb
    check (jsonb_typeof(booking_ids) = 'array'),
  beneficiary_type text not null
    check (beneficiary_type in ('platform', 'client', 'provider', 'external')),
  beneficiary_account_id uuid references public.accounts(id) on delete restrict,
  beneficiary_profile_id uuid references public.profiles(id) on delete restrict,
  cause text not null check (length(trim(cause)) > 0),
  previous_state text,
  new_state text,
  source text not null
    check (
      source in (
        'payment',
        'settlement',
        'refund',
        'payout',
        'reconciliation',
        'migration'
      )
    ),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_transfer_id text,
  stripe_transfer_reversal_id text,
  stripe_refund_id text,
  stripe_payout_id text,
  stripe_balance_transaction_id text,
  settlement_reference text,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  previous_entry_hash text,
  entry_hash text not null unique,
  created_at timestamptz not null default now(),
  check (
    booking_id is not null
    or jsonb_array_length(booking_ids) > 0
  )
);

create index if not exists financial_ledger_entries_booking_idx
  on public.financial_ledger_entries(booking_id, sequence_id);

create index if not exists financial_ledger_entries_movement_idx
  on public.financial_ledger_entries(movement_type, occurred_at desc);

create index if not exists financial_ledger_entries_beneficiary_idx
  on public.financial_ledger_entries(beneficiary_account_id, occurred_at desc);

create index if not exists financial_ledger_entries_transfer_idx
  on public.financial_ledger_entries(stripe_transfer_id)
  where stripe_transfer_id is not null;

create index if not exists financial_ledger_entries_refund_idx
  on public.financial_ledger_entries(stripe_refund_id)
  where stripe_refund_id is not null;

create index if not exists financial_ledger_entries_payout_idx
  on public.financial_ledger_entries(stripe_payout_id)
  where stripe_payout_id is not null;

comment on table public.financial_ledger_entries is
  'Canonical append-only KLYX financial ledger. Stripe ids are evidence/references, never the accounting authority.';

comment on table public.booking_financial_ledger is
  'LEGACY compatibility journal. Non-authoritative after Canonical Financial Ledger migration; do not use as KLYX accounting truth.';

comment on column public.financial_ledger_entries.event_key is
  'Deterministic KLYX idempotency key. Reuse with different immutable facts is rejected.';

comment on column public.financial_ledger_entries.entry_hash is
  'Tamper-evident SHA-256 hash over immutable entry facts and the previous canonical ledger hash.';

create table if not exists public.financial_reconciliation_cases (
  id uuid primary key default gen_random_uuid(),
  case_key text not null unique,
  booking_id uuid references public.bookings(id) on delete restrict,
  booking_ids jsonb not null default '[]'::jsonb
    check (jsonb_typeof(booking_ids) = 'array'),
  status text not null
    check (status in ('reconciliation', 'human_review', 'resolved')),
  divergence_code text not null,
  reason text not null,
  ledger_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(ledger_snapshot) = 'object'),
  stripe_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(stripe_snapshot) = 'object'),
  settlement_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settlement_snapshot) = 'object'),
  detected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (
    booking_id is not null
    or jsonb_array_length(booking_ids) > 0
  )
);

create table if not exists public.financial_reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null
    references public.financial_reconciliation_cases(id) on delete restrict,
  event_key text not null unique,
  previous_status text,
  new_status text not null
    check (new_status in ('reconciliation', 'human_review', 'resolved')),
  reason_code text not null,
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists financial_reconciliation_cases_status_idx
  on public.financial_reconciliation_cases(status, detected_at desc);

create index if not exists financial_reconciliation_events_case_idx
  on public.financial_reconciliation_events(case_id, created_at);

comment on table public.financial_reconciliation_cases is
  'Explicit KLYX reconciliation cases. Divergent financial truth is never silently rewritten.';
comment on table public.financial_reconciliation_events is
  'Immutable audit trail for reconciliation and human-review state transitions.';

create or replace function public.klyx_reject_financial_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'KLYX_CANONICAL_LEDGER_IMMUTABLE';
end;
$$;

drop trigger if exists financial_ledger_entries_immutable
  on public.financial_ledger_entries;

create trigger financial_ledger_entries_immutable
before update or delete on public.financial_ledger_entries
for each row
execute function public.klyx_reject_financial_ledger_mutation();

drop trigger if exists financial_reconciliation_events_immutable
  on public.financial_reconciliation_events;

create trigger financial_reconciliation_events_immutable
before update or delete on public.financial_reconciliation_events
for each row
execute function public.klyx_reject_financial_ledger_mutation();

create or replace function public.klyx_append_financial_ledger_entry(
  p_event_key text,
  p_movement_type text,
  p_amount_cents bigint,
  p_currency text,
  p_booking_id uuid,
  p_booking_ids jsonb,
  p_beneficiary_type text,
  p_beneficiary_account_id uuid,
  p_beneficiary_profile_id uuid,
  p_cause text,
  p_previous_state text,
  p_new_state text,
  p_source text,
  p_stripe_checkout_session_id text default null,
  p_stripe_payment_intent_id text default null,
  p_stripe_charge_id text default null,
  p_stripe_transfer_id text default null,
  p_stripe_transfer_reversal_id text default null,
  p_stripe_refund_id text default null,
  p_stripe_payout_id text default null,
  p_stripe_balance_transaction_id text default null,
  p_settlement_reference text default null,
  p_occurred_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.financial_ledger_entries%rowtype;
  v_previous_hash text;
  v_entry_hash text;
  v_booking_ids jsonb := coalesce(p_booking_ids, '[]'::jsonb);
  v_currency text := upper(trim(coalesce(p_currency, '')));
  v_occurred_at timestamptz := coalesce(p_occurred_at, now());
  v_id uuid;
begin
  if coalesce(trim(p_event_key), '') = '' then
    raise exception 'KLYX_LEDGER_EVENT_KEY_REQUIRED';
  end if;

  if p_movement_type not in (
    'charge', 'commission', 'provider_liability',
    'transfer', 'reversal', 'refund', 'payout'
  ) then
    raise exception 'KLYX_LEDGER_MOVEMENT_TYPE_INVALID';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'KLYX_LEDGER_AMOUNT_INVALID';
  end if;

  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'KLYX_LEDGER_CURRENCY_INVALID';
  end if;

  if p_booking_id is null
     and (
       jsonb_typeof(v_booking_ids) <> 'array'
       or jsonb_array_length(v_booking_ids) = 0
     ) then
    raise exception 'KLYX_LEDGER_BOOKING_REQUIRED';
  end if;

  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'KLYX_LEDGER_METADATA_INVALID';
  end if;

  if coalesce(trim(p_cause), '') = '' then
    raise exception 'KLYX_LEDGER_CAUSE_REQUIRED';
  end if;

  select *
    into v_existing
    from public.financial_ledger_entries
   where event_key = p_event_key;

  if found then
    if v_existing.movement_type is distinct from p_movement_type
       or v_existing.amount_cents is distinct from p_amount_cents
       or v_existing.currency is distinct from v_currency
       or v_existing.booking_id is distinct from p_booking_id
       or v_existing.booking_ids is distinct from v_booking_ids
       or v_existing.beneficiary_type is distinct from p_beneficiary_type
       or v_existing.beneficiary_account_id is distinct from p_beneficiary_account_id
       or v_existing.beneficiary_profile_id is distinct from p_beneficiary_profile_id
       or v_existing.cause is distinct from p_cause
       or v_existing.previous_state is distinct from p_previous_state
       or v_existing.new_state is distinct from p_new_state
       or v_existing.source is distinct from p_source
       or v_existing.stripe_checkout_session_id is distinct from p_stripe_checkout_session_id
       or v_existing.stripe_payment_intent_id is distinct from p_stripe_payment_intent_id
       or v_existing.stripe_charge_id is distinct from p_stripe_charge_id
       or v_existing.stripe_transfer_id is distinct from p_stripe_transfer_id
       or v_existing.stripe_transfer_reversal_id is distinct from p_stripe_transfer_reversal_id
       or v_existing.stripe_refund_id is distinct from p_stripe_refund_id
       or v_existing.stripe_payout_id is distinct from p_stripe_payout_id
       or v_existing.stripe_balance_transaction_id is distinct from p_stripe_balance_transaction_id
       or v_existing.settlement_reference is distinct from p_settlement_reference then
      raise exception 'KLYX_LEDGER_EVENT_KEY_CONFLICT';
    end if;

    return v_existing.id;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      coalesce(p_booking_id::text, v_booking_ids::text),
      826
    )
  );

  select entry_hash
    into v_previous_hash
    from public.financial_ledger_entries
   where (
     (p_booking_id is not null and booking_id = p_booking_id)
     or (
       p_booking_id is null
       and booking_id is null
       and booking_ids = v_booking_ids
     )
   )
   order by sequence_id desc
   limit 1;

  v_entry_hash := encode(
    digest(
      concat_ws(
        '|',
        coalesce(v_previous_hash, 'GENESIS'),
        trim(p_event_key),
        p_movement_type,
        p_amount_cents::text,
        v_currency,
        coalesce(p_booking_id::text, ''),
        v_booking_ids::text,
        p_beneficiary_type,
        coalesce(p_beneficiary_account_id::text, ''),
        coalesce(p_beneficiary_profile_id::text, ''),
        trim(p_cause),
        coalesce(p_previous_state, ''),
        coalesce(p_new_state, ''),
        p_source,
        coalesce(p_stripe_checkout_session_id, ''),
        coalesce(p_stripe_payment_intent_id, ''),
        coalesce(p_stripe_charge_id, ''),
        coalesce(p_stripe_transfer_id, ''),
        coalesce(p_stripe_transfer_reversal_id, ''),
        coalesce(p_stripe_refund_id, ''),
        coalesce(p_stripe_payout_id, ''),
        coalesce(p_stripe_balance_transaction_id, ''),
        coalesce(p_settlement_reference, ''),
        v_occurred_at::text,
        coalesce(p_metadata, '{}'::jsonb)::text
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.financial_ledger_entries (
    event_key,
    movement_type,
    amount_cents,
    currency,
    booking_id,
    booking_ids,
    beneficiary_type,
    beneficiary_account_id,
    beneficiary_profile_id,
    cause,
    previous_state,
    new_state,
    source,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    stripe_charge_id,
    stripe_transfer_id,
    stripe_transfer_reversal_id,
    stripe_refund_id,
    stripe_payout_id,
    stripe_balance_transaction_id,
    settlement_reference,
    occurred_at,
    metadata,
    previous_entry_hash,
    entry_hash
  ) values (
    trim(p_event_key),
    p_movement_type,
    p_amount_cents,
    v_currency,
    p_booking_id,
    v_booking_ids,
    p_beneficiary_type,
    p_beneficiary_account_id,
    p_beneficiary_profile_id,
    trim(p_cause),
    p_previous_state,
    p_new_state,
    p_source,
    p_stripe_checkout_session_id,
    p_stripe_payment_intent_id,
    p_stripe_charge_id,
    p_stripe_transfer_id,
    p_stripe_transfer_reversal_id,
    p_stripe_refund_id,
    p_stripe_payout_id,
    p_stripe_balance_transaction_id,
    p_settlement_reference,
    v_occurred_at,
    coalesce(p_metadata, '{}'::jsonb),
    v_previous_hash,
    v_entry_hash
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.klyx_open_financial_reconciliation_case(
  p_case_key text,
  p_booking_id uuid,
  p_booking_ids jsonb,
  p_divergence_code text,
  p_reason text,
  p_ledger_snapshot jsonb,
  p_stripe_snapshot jsonb,
  p_settlement_snapshot jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if coalesce(trim(p_case_key), '') = ''
     or coalesce(trim(p_divergence_code), '') = ''
     or coalesce(trim(p_reason), '') = '' then
    raise exception 'KLYX_RECONCILIATION_CASE_INVALID';
  end if;

  insert into public.financial_reconciliation_cases (
    case_key,
    booking_id,
    booking_ids,
    status,
    divergence_code,
    reason,
    ledger_snapshot,
    stripe_snapshot,
    settlement_snapshot
  ) values (
    trim(p_case_key),
    p_booking_id,
    coalesce(p_booking_ids, '[]'::jsonb),
    'reconciliation',
    trim(p_divergence_code),
    trim(p_reason),
    coalesce(p_ledger_snapshot, '{}'::jsonb),
    coalesce(p_stripe_snapshot, '{}'::jsonb),
    coalesce(p_settlement_snapshot, '{}'::jsonb)
  )
  on conflict (case_key) do nothing
  returning id into v_id;

  if v_id is null then
    select id
      into v_id
      from public.financial_reconciliation_cases
     where case_key = trim(p_case_key);
  end if;

  return v_id;
end;
$$;

create or replace function public.klyx_transition_financial_reconciliation_case(
  p_case_id uuid,
  p_event_key text,
  p_new_status text,
  p_reason_code text,
  p_details jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous_status text;
  v_updated integer;
begin
  if p_new_status not in ('reconciliation', 'human_review', 'resolved') then
    raise exception 'KLYX_RECONCILIATION_STATUS_INVALID';
  end if;

  select status
    into v_previous_status
    from public.financial_reconciliation_cases
   where id = p_case_id
   for update;

  if not found then
    return false;
  end if;

  insert into public.financial_reconciliation_events (
    case_id,
    event_key,
    previous_status,
    new_status,
    reason_code,
    details
  ) values (
    p_case_id,
    trim(p_event_key),
    v_previous_status,
    p_new_status,
    trim(p_reason_code),
    coalesce(p_details, '{}'::jsonb)
  )
  on conflict (event_key) do nothing;

  update public.financial_reconciliation_cases
     set status = p_new_status,
         updated_at = now(),
         resolved_at = case when p_new_status = 'resolved' then now() else null end
   where id = p_case_id
     and status is distinct from p_new_status;

  get diagnostics v_updated = row_count;

  return v_updated = 1 or v_previous_status = p_new_status;
end;
$$;

alter table public.financial_ledger_entries enable row level security;
alter table public.financial_reconciliation_cases enable row level security;
alter table public.financial_reconciliation_events enable row level security;

revoke all privileges on table public.financial_ledger_entries
  from public, anon, authenticated, service_role;
revoke all privileges on table public.financial_reconciliation_cases
  from public, anon, authenticated, service_role;
revoke all privileges on table public.financial_reconciliation_events
  from public, anon, authenticated, service_role;

grant select on table public.financial_ledger_entries to service_role;
grant select on table public.financial_reconciliation_cases to service_role;
grant select on table public.financial_reconciliation_events to service_role;

revoke all on function public.klyx_reject_financial_ledger_mutation()
  from public, anon, authenticated;
revoke all on function public.klyx_append_financial_ledger_entry(
  text, text, bigint, text, uuid, jsonb, text, uuid, uuid, text, text, text,
  text, text, text, text, text, text, text, text, text, text, timestamptz, jsonb
) from public, anon, authenticated;
revoke all on function public.klyx_open_financial_reconciliation_case(
  text, uuid, jsonb, text, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.klyx_transition_financial_reconciliation_case(
  uuid, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.klyx_append_financial_ledger_entry(
  text, text, bigint, text, uuid, jsonb, text, uuid, uuid, text, text, text,
  text, text, text, text, text, text, text, text, text, text, timestamptz, jsonb
) to service_role;
grant execute on function public.klyx_open_financial_reconciliation_case(
  text, uuid, jsonb, text, text, jsonb, jsonb, jsonb
) to service_role;
grant execute on function public.klyx_transition_financial_reconciliation_case(
  uuid, text, text, text, jsonb
) to service_role;

commit;
