-- KLYX Sumsub webhook durable retry lease.
-- Preserve the legacy processed boolean while making status + attempt_count
-- the authoritative single-worker claim/fencing state.

alter table public.sumsub_webhook_events
  add column if not exists status text,
  add column if not exists attempt_count integer,
  add column if not exists updated_at timestamptz;

update public.sumsub_webhook_events
set
  status = coalesce(
    status,
    case
      when processed then 'processed'
      else 'failed'
    end
  ),
  attempt_count = coalesce(attempt_count, 1),
  updated_at = coalesce(updated_at, processed_at, received_at, now())
where status is null
   or attempt_count is null
   or updated_at is null;

alter table public.sumsub_webhook_events
  alter column status set default 'processing',
  alter column status set not null,
  alter column attempt_count set default 1,
  alter column attempt_count set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.sumsub_webhook_events
  drop constraint if exists sumsub_webhook_events_status_check,
  add constraint sumsub_webhook_events_status_check
    check (status in ('processing', 'processed', 'failed')),
  drop constraint if exists sumsub_webhook_events_attempt_count_check,
  add constraint sumsub_webhook_events_attempt_count_check
    check (attempt_count >= 1),
  drop constraint if exists sumsub_webhook_events_processed_status_check,
  add constraint sumsub_webhook_events_processed_status_check
    check (processed = (status = 'processed'));

comment on column public.sumsub_webhook_events.status is
  'Durable processing state for the Sumsub webhook single-worker retry lease.';

comment on column public.sumsub_webhook_events.attempt_count is
  'Monotonic lease generation used to fence stale Sumsub webhook workers.';

comment on column public.sumsub_webhook_events.updated_at is
  'Lease timestamp used to detect stale Sumsub webhook processing attempts.';
