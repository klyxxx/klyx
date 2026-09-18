begin;

create table if not exists public.transaction_risk_decisions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  action text not null,
  participant text not null,
  decision text not null,
  reason_codes text[] not null default '{}'::text[],
  risk_score integer not null,
  risk_level text not null,
  risk_assessed_at timestamptz not null,
  subject_type text not null,
  subject_id text not null,
  deduplication_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transaction_risk_decisions_action_check
    check (action in ('checkout_create')),
  constraint transaction_risk_decisions_participant_check
    check (participant in ('payer', 'recipient')),
  constraint transaction_risk_decisions_decision_check
    check (decision in ('allow', 'review_required', 'blocked')),
  constraint transaction_risk_decisions_score_check
    check (risk_score between 0 and 100),
  constraint transaction_risk_decisions_level_check
    check (risk_level in ('low', 'moderate', 'high', 'critical')),
  constraint transaction_risk_decisions_subject_type_check
    check (subject_type in ('booking', 'booking_group', 'split_batch'))
);

create unique index if not exists transaction_risk_decisions_dedup_unique
  on public.transaction_risk_decisions(deduplication_key);

create index if not exists transaction_risk_decisions_account_created_idx
  on public.transaction_risk_decisions(account_id, created_at desc);

create index if not exists transaction_risk_decisions_review_idx
  on public.transaction_risk_decisions(decision, updated_at desc)
  where decision in ('review_required', 'blocked');

alter table public.transaction_risk_decisions enable row level security;

revoke all privileges on table public.transaction_risk_decisions
  from public, anon, authenticated;

comment on table public.transaction_risk_decisions is
  'Server-only canonical KLYX transaction-risk preflight decisions. This table does not represent a permanent account suspension.';

commit;
