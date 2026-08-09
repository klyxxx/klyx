-- KLYX STEP 8.1
-- Journal financier interne par reservation.

create extension if not exists pgcrypto;

create table if not exists public.booking_financial_ledger (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  entry_key text not null unique,
  entry_type text not null
    check (entry_type in ('payment_succeeded','payment_failed','refund_succeeded','refund_failed')),
  status text not null
    check (status in ('succeeded','failed','processing')),
  currency text not null default 'EUR',
  gross_amount_cents integer not null default 0,
  platform_fee_cents integer not null default 0,
  provider_amount_cents integer,
  refund_amount_cents integer not null default 0,
  payment_mode text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_refund_id text,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_financial_ledger_booking_idx
  on public.booking_financial_ledger(booking_id, created_at desc);

create index if not exists booking_financial_ledger_status_idx
  on public.booking_financial_ledger(status, created_at desc);

alter table public.booking_financial_ledger enable row level security;

comment on table public.booking_financial_ledger is
  'Journal financier serveur KLYX. Une ecriture immutable-logique par evenement financier.';
