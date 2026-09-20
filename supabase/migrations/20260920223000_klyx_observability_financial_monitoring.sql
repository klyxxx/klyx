begin;

-- KLYX MISSION 16 — OBSERVABILITY + FINANCIAL MONITORING
--
-- This mission adds read-only monitoring projections over canonical KLYX truth.
-- It does not become Booking, Ledger, Settlement, Reconciliation, Risk,
-- Eligibility, Durable Jobs, Human Operations or Incident authority.
--
-- No financial mutation and no automated operational blocking is introduced.

create or replace view public.ops_observability_signals_current as
select
  concat('operation:', o.id::text, ':failed') as signal_key,
  'operation_failed'::text as signal_type,
  'error'::text as severity,
  'ops_operation'::text as source_type,
  o.id::text as source_ref,
  o.id as operation_id,
  o.correlation_id,
  o.failure_domain_type,
  o.failure_domain_key,
  o.market_id,
  o.region_id,
  o.country_code,
  o.currency,
  o.payment_provider,
  o.capability,
  o.dependency,
  coalesce(o.completed_at, o.updated_at, o.started_at) as occurred_at,
  greatest(
    0::bigint,
    floor(
      extract(
        epoch from (
          now() - coalesce(o.completed_at, o.updated_at, o.started_at)
        )
      )
    )::bigint
  ) as age_seconds,
  o.financial_impact_minor,
  o.financial_currency
from public.ops_operations as o
where o.status = 'failed'

union all

select
  concat('event:', e.id::text) as signal_key,
  e.event_type as signal_type,
  e.severity,
  'ops_event'::text as source_type,
  e.id::text as source_ref,
  e.operation_id,
  e.correlation_id,
  e.failure_domain_type,
  e.failure_domain_key,
  e.market_id,
  e.region_id,
  e.country_code,
  e.currency,
  e.payment_provider,
  e.capability,
  e.dependency,
  e.created_at as occurred_at,
  greatest(
    0::bigint,
    floor(extract(epoch from (now() - e.created_at)))::bigint
  ) as age_seconds,
  null::bigint as financial_impact_minor,
  null::text as financial_currency
from public.ops_events as e
where e.severity in ('error', 'critical')

union all

select
  concat('durable_job:', j.id::text, ':dead_lettered') as signal_key,
  'durable_job_dead_lettered'::text as signal_type,
  'error'::text as severity,
  'durable_job'::text as source_type,
  j.id::text as source_ref,
  j.operation_id,
  j.correlation_id,
  j.failure_domain_type,
  j.failure_domain_key,
  j.market_id,
  j.region_id,
  j.country_code,
  j.currency,
  j.payment_provider,
  j.capability,
  j.dependency,
  coalesce(j.dead_lettered_at, j.updated_at) as occurred_at,
  greatest(
    0::bigint,
    floor(
      extract(
        epoch from (
          now() - coalesce(j.dead_lettered_at, j.updated_at)
        )
      )
    )::bigint
  ) as age_seconds,
  null::bigint as financial_impact_minor,
  null::text as financial_currency
from public.ops_durable_jobs as j
where j.status = 'dead_lettered'

union all

select
  concat('human_case:', c.id::text, ':overdue') as signal_key,
  'human_case_overdue'::text as signal_type,
  case
    when c.priority = 'critical' then 'critical'
    when c.priority = 'high' then 'error'
    else 'warning'
  end::text as severity,
  'human_case'::text as source_type,
  c.id::text as source_ref,
  c.operation_id,
  c.correlation_id,
  c.failure_domain_type,
  c.failure_domain_key,
  c.market_id,
  c.region_id,
  c.country_code,
  c.currency,
  c.payment_provider,
  c.capability,
  c.dependency,
  c.due_at as occurred_at,
  greatest(
    0::bigint,
    floor(extract(epoch from (now() - c.due_at)))::bigint
  ) as age_seconds,
  null::bigint as financial_impact_minor,
  null::text as financial_currency
from public.ops_human_cases as c
where c.status in ('open', 'triage', 'in_review', 'waiting_external')
  and c.due_at is not null
  and c.due_at < now();

comment on view public.ops_observability_signals_current is
  'Read-only derived operational health signals. These rows are observations only and never replace canonical domain or Operations truth.';

revoke all privileges on table public.ops_observability_signals_current
  from public, anon, authenticated, service_role;
grant select on table public.ops_observability_signals_current
  to service_role;

create or replace view public.financial_monitoring_signals_current as
select
  concat('financial_reconciliation:', r.id::text) as signal_key,
  'financial_reconciliation_open'::text as signal_type,
  case
    when r.state = 'human_review' then 'critical'
    else 'warning'
  end::text as severity,
  'financial_reconciliation_case'::text as source_type,
  r.id::text as source_ref,
  r.booking_id,
  null::text as currency,
  r.dimension,
  r.reason_code,
  r.state,
  r.opened_at as occurred_at,
  greatest(
    0::bigint,
    floor(extract(epoch from (now() - r.opened_at)))::bigint
  ) as age_seconds
from public.financial_reconciliation_current as r
where r.state in ('reconciliation', 'human_review')

union all

select
  concat('settlement:', s.booking_id::text, ':', s.state) as signal_key,
  case
    when s.state = 'release_failed' then 'settlement_release_failed'
    when s.state = 'review_required' then 'settlement_review_required'
    else 'settlement_release_claimed'
  end::text as signal_type,
  case
    when s.state = 'release_failed' then 'error'
    when s.state = 'review_required' then 'warning'
    else 'info'
  end::text as severity,
  'booking_settlement'::text as source_type,
  s.booking_id::text as source_ref,
  s.booking_id,
  s.currency,
  'settlement_state'::text as dimension,
  case
    when s.state = 'release_failed' then
      coalesce(nullif(trim(s.last_error_code), ''), 'SETTLEMENT_RELEASE_FAILED')
    when s.state = 'review_required' then 'SETTLEMENT_REVIEW_REQUIRED'
    else 'SETTLEMENT_RELEASE_CLAIMED'
  end::text as reason_code,
  s.state,
  case
    when s.state = 'release_claimed' then
      coalesce(s.release_claimed_at, s.updated_at)
    else s.updated_at
  end as occurred_at,
  greatest(
    0::bigint,
    floor(
      extract(
        epoch from (
          now() -
          case
            when s.state = 'release_claimed' then
              coalesce(s.release_claimed_at, s.updated_at)
            else s.updated_at
          end
        )
      )
    )::bigint
  ) as age_seconds
from public.booking_settlements as s
where s.state in ('review_required', 'release_claimed', 'release_failed')

union all

select
  concat('ledger:', l.id::text, ':unresolved_beneficiary') as signal_key,
  'ledger_unresolved_beneficiary'::text as signal_type,
  'critical'::text as severity,
  'financial_ledger_movement'::text as source_type,
  l.id::text as source_ref,
  l.booking_id,
  l.currency,
  'beneficiary_resolution'::text as dimension,
  'UNRESOLVED_PROVIDER_ACCOUNT'::text as reason_code,
  l.new_state as state,
  l.occurred_at,
  greatest(
    0::bigint,
    floor(extract(epoch from (now() - l.occurred_at)))::bigint
  ) as age_seconds
from public.financial_ledger_current as l
where l.beneficiary_ref like 'unresolved-profile:%';

comment on view public.financial_monitoring_signals_current is
  'Read-only financial monitoring signals derived from canonical reconciliation, settlement and ledger truth. No row authorizes or mutates money movement.';

revoke all privileges on table public.financial_monitoring_signals_current
  from public, anon, authenticated, service_role;
grant select on table public.financial_monitoring_signals_current
  to service_role;

create or replace view public.financial_monitoring_flow_24h as
select
  l.currency,
  l.movement_type,
  count(*)::bigint as movement_count,
  sum(l.amount_minor)::numeric as amount_minor_total,
  min(l.occurred_at) as earliest_occurred_at,
  max(l.occurred_at) as latest_occurred_at
from public.financial_ledger_current as l
where l.occurred_at >= now() - interval '24 hours'
group by l.currency, l.movement_type;

comment on view public.financial_monitoring_flow_24h is
  'Read-only 24h canonical ledger flow grouped by currency and movement type. Amounts are never aggregated across currencies.';

revoke all privileges on table public.financial_monitoring_flow_24h
  from public, anon, authenticated, service_role;
grant select on table public.financial_monitoring_flow_24h
  to service_role;

commit;
