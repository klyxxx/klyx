-- KLYX account-first post-booking incident orchestration.
--
-- Incident truth is operational/audit data. Monetary truth remains exclusively
-- in bookings + booking_financial_ledger + realized business_cost_events.
-- No trigger in this migration can create a charge, refund, payout or sanction.

begin;

create table if not exists public.booking_incidents (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  subject_account_id uuid references public.accounts(id) on delete set null,
  reporter_profile_id uuid references public.profiles(id) on delete set null,
  incident_type text not null,
  status text not null default 'open',
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  policy_version text not null,
  policy_snapshot jsonb not null default '{}'::jsonb,
  human_review_required boolean not null default false,
  refund_handling text not null default 'none',
  replacement_plan_id uuid references public.client_agent_plans(id) on delete set null,
  replacement_candidate_count integer not null default 0,
  replacement_search_status text not null default 'idle',
  replacement_search_attempt integer not null default 0,
  trust_case_id uuid references public.trust_cases(id) on delete set null,
  legacy_dispute_id uuid references public.disputes(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint booking_incidents_type_check check (incident_type in (
    'cancellation',
    'provider_no_show',
    'client_no_show',
    'delay',
    'impossible_mission',
    'quality_issue',
    'replacement_request',
    'dispute',
    'refund_expected'
  )),
  constraint booking_incidents_status_check check (status in (
    'open',
    'replacement_ready',
    'human_review',
    'action_required',
    'resolved',
    'closed'
  )),
  constraint booking_incidents_reason_length_check
    check (char_length(trim(reason)) between 5 and 1000),
  constraint booking_incidents_evidence_object_check
    check (jsonb_typeof(evidence) = 'object'),
  constraint booking_incidents_policy_snapshot_object_check
    check (jsonb_typeof(policy_snapshot) = 'object'),
  constraint booking_incidents_refund_handling_check
    check (refund_handling in ('none', 'existing_policy', 'human_review')),
  constraint booking_incidents_candidate_count_check
    check (replacement_candidate_count >= 0),
  constraint booking_incidents_search_status_check
    check (replacement_search_status in ('idle', 'running', 'ready', 'failed')),
  constraint booking_incidents_search_attempt_check
    check (replacement_search_attempt >= 0)
);

create unique index if not exists booking_incidents_one_active_type_idx
  on public.booking_incidents (booking_id, account_id, incident_type)
  where status in ('open', 'replacement_ready', 'human_review', 'action_required');
create unique index if not exists booking_incidents_replacement_plan_unique_idx
  on public.booking_incidents (replacement_plan_id)
  where replacement_plan_id is not null;
create unique index if not exists booking_incidents_trust_case_unique_idx
  on public.booking_incidents (trust_case_id)
  where trust_case_id is not null;
create index if not exists booking_incidents_booking_created_idx
  on public.booking_incidents (booking_id, created_at desc);
create index if not exists booking_incidents_account_created_idx
  on public.booking_incidents (account_id, created_at desc);
create index if not exists booking_incidents_human_review_idx
  on public.booking_incidents (human_review_required, created_at asc)
  where human_review_required = true and status not in ('resolved', 'closed');

comment on table public.booking_incidents is
  'Canonical account-owned incident ledger for post-booking recovery. It stores evidence and deterministic policy outcomes but no independent monetary truth.';
comment on column public.booking_incidents.reporter_profile_id is
  'Legacy booking participant provenance only. account_id is the canonical owner.';
comment on column public.booking_incidents.refund_handling is
  'Routing only. Refund execution remains in the existing booking/Stripe refund lifecycle.';

create table if not exists public.booking_incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.booking_incidents(id) on delete cascade,
  actor_type text not null,
  actor_account_id uuid references public.accounts(id) on delete set null,
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  event_key text unique,
  reason_code text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint booking_incident_events_actor_type_check
    check (actor_type in ('system', 'account', 'reviewer')),
  constraint booking_incident_events_type_check check (event_type in (
    'opened',
    'evidence_added',
    'policy_evaluated',
    'replacement_search_started',
    'replacement_candidates_ready',
    'replacement_presented',
    'replacement_selected',
    'replacement_declined',
    'human_review_requested',
    'linked_dispute',
    'refund_policy_reused',
    'resolved',
    'note'
  )),
  constraint booking_incident_events_payload_object_check
    check (jsonb_typeof(payload) = 'object')
);

create index if not exists booking_incident_events_incident_created_idx
  on public.booking_incident_events (incident_id, created_at asc);

comment on table public.booking_incident_events is
  'Append-only decision/evidence history for post-booking incidents. service_role receives no UPDATE or DELETE privilege.';

-- Prevent duplicate Trust & Safety cases when the same incident request races.
create unique index if not exists trust_cases_post_booking_incident_unique_idx
  on public.trust_cases ((details->>'incident_id'))
  where details->>'origin' = 'post_booking_incident';

alter table public.booking_incidents enable row level security;
alter table public.booking_incident_events enable row level security;

revoke all privileges on table public.booking_incidents
  from public, anon, authenticated;
revoke all privileges on table public.booking_incident_events
  from public, anon, authenticated;

grant select, insert, update, delete on table public.booking_incidents to service_role;
grant select, insert on table public.booking_incident_events to service_role;

-- Unit-economics attribution read model only. No money is stored here: refunds
-- come from booking_financial_ledger and realized support/fraud costs come from
-- business_cost_events, preserving the existing accounting source of truth.
create or replace view public.business_booking_incident_attribution as
select
  bi.id as incident_id,
  bi.booking_id,
  b.service_id,
  bi.incident_type,
  bi.status as incident_status,
  bi.human_review_required,
  bi.replacement_candidate_count,
  bi.created_at as incident_created_at,
  coalesce((
    select sum(l.refund_amount_cents)
    from public.booking_financial_ledger l
    where l.booking_id = bi.booking_id
      and l.entry_type = 'refund_succeeded'
      and l.status = 'succeeded'
  ), 0)::bigint as refund_amount_cents,
  coalesce((
    select sum(c.amount_cents)
    from public.business_cost_events c
    where c.booking_id = bi.booking_id
      and c.cost_type = 'support'
  ), 0)::bigint as support_cost_cents,
  coalesce((
    select sum(c.amount_cents)
    from public.business_cost_events c
    where c.booking_id = bi.booking_id
      and c.cost_type = 'fraud_dispute'
  ), 0)::bigint as fraud_dispute_cost_cents
from public.booking_incidents bi
join public.bookings b on b.id = bi.booking_id;

comment on view public.business_booking_incident_attribution is
  'Read-only incident attribution for existing KLYX unit economics. Monetary values are derived from the canonical ledgers and are never duplicated here.';

revoke all privileges on public.business_booking_incident_attribution
  from public, anon, authenticated;
grant select on public.business_booking_incident_attribution to service_role;

commit;
