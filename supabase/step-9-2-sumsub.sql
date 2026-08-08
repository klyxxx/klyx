-- KLYX ETAPE 9.2
-- Integration Sumsub : decision KYC externe + journal webhook.

alter table public.provider_verifications
  add column if not exists external_provider text,
  add column if not exists external_applicant_id text,
  add column if not exists external_review_status text,
  add column if not exists external_review_answer text,
  add column if not exists external_reject_type text,
  add column if not exists external_moderation_comment text,
  add column if not exists external_sandbox_mode boolean,
  add column if not exists external_updated_at timestamptz;

create unique index if not exists provider_verifications_external_applicant_idx
  on public.provider_verifications(external_applicant_id)
  where external_applicant_id is not null;

create table if not exists public.sumsub_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_hash text not null unique,
  event_type text,
  applicant_id text,
  external_user_id text,
  review_status text,
  review_answer text,
  sandbox_mode boolean,
  processed boolean not null default false,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists sumsub_webhook_events_applicant_idx
  on public.sumsub_webhook_events(applicant_id, received_at desc);

create index if not exists sumsub_webhook_events_external_user_idx
  on public.sumsub_webhook_events(external_user_id, received_at desc);

alter table public.sumsub_webhook_events enable row level security;

comment on table public.sumsub_webhook_events is
  'Journal serveur des webhooks Sumsub KLYX. Aucun acces direct client.';

comment on column public.provider_verifications.external_review_answer is
  'Decision finale du fournisseur externe, par exemple GREEN ou RED.';
