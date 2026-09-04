-- KLYX transactional email delivery registry
-- Server/service-role only: no browser policy is intentionally granted.

create table if not exists public.transactional_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  deduplication_key text not null unique,
  template_key text not null,
  recipient_profile_id uuid null,
  recipient_email text null,
  recipient_email_hash text null,
  status text not null default 'sending'
    check (status in ('sending', 'sent', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz null,
  constraint transactional_email_recipient_present
    check (
      recipient_profile_id is not null
      or nullif(btrim(recipient_email), '') is not null
      or nullif(btrim(recipient_email_hash), '') is not null
    )
);

alter table public.transactional_email_deliveries enable row level security;

create index if not exists transactional_email_deliveries_status_idx
  on public.transactional_email_deliveries (status, updated_at desc);

comment on table public.transactional_email_deliveries is
  'Server-only idempotency and delivery audit for KLYX transactional email. Direct recipient addresses are hashed before persistence.';
