begin;

create table if not exists public.account_risk_assessments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  risk_score integer not null default 0,
  risk_level text not null default 'low',
  signals jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_risk_assessments_score_check
    check (risk_score between 0 and 100),
  constraint account_risk_assessments_level_check
    check (risk_level in ('low', 'moderate', 'high', 'critical'))
);

create unique index if not exists account_risk_assessments_account_unique
  on public.account_risk_assessments(account_id);

create index if not exists account_risk_assessments_level_idx
  on public.account_risk_assessments(risk_level, assessed_at desc);

create table if not exists public.account_security_alerts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  alert_type text not null,
  severity text not null,
  title text not null,
  description text not null,
  status text not null default 'open',
  deduplication_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_security_alerts_severity_check
    check (severity in ('info', 'warning', 'high', 'critical')),
  constraint account_security_alerts_status_check
    check (status in ('open', 'acknowledged', 'resolved'))
);

create unique index if not exists account_security_alerts_deduplication_unique
  on public.account_security_alerts(deduplication_key);

create index if not exists account_security_alerts_account_status_idx
  on public.account_security_alerts(account_id, status, created_at desc);

alter table public.account_risk_assessments enable row level security;
alter table public.account_security_alerts enable row level security;

revoke all privileges on table public.account_risk_assessments
  from public, anon, authenticated;
revoke all privileges on table public.account_security_alerts
  from public, anon, authenticated;

comment on table public.account_risk_assessments is
  'Canonical account-level KLYX risk assessment. Legacy profile_risk_assessments remain historical compatibility data.';

comment on table public.account_security_alerts is
  'Server-only canonical account-level security alerts. Legacy security_alerts remain historical compatibility data.';

commit;
