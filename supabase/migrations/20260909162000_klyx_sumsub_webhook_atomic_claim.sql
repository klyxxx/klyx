-- KLYX Sumsub webhook atomic claim lease.
-- Adds a durable single-worker processing lease while preserving the legacy
-- processed boolean used by existing audit/history code.

alter table public.sumsub_webhook_events
  add column if not exists status text,
  add column if not exists attempt_count integer,
  add column if not exists updated_at timestamptz;

update public.sumsub_webhook_events
set status = case
  when processed then 'processed'
  when last_error is not null then 'failed'
  else 'processing'
end
where status is null;

update public.sumsub_webhook_events
set attempt_count = 1
where attempt_count is null or attempt_count < 1;

update public.sumsub_webhook_events
set updated_at = coalesce(processed_at, received_at, now())
where updated_at is null;

alter table public.sumsub_webhook_events
  alter column status set default 'processing',
  alter column status set not null,
  alter column attempt_count set default 1,
  alter column attempt_count set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sumsub_webhook_events_status_check'
      and conrelid = 'public.sumsub_webhook_events'::regclass
  ) then
    alter table public.sumsub_webhook_events
      add constraint sumsub_webhook_events_status_check
      check (status in ('processing', 'processed', 'failed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'sumsub_webhook_events_attempt_count_check'
      and conrelid = 'public.sumsub_webhook_events'::regclass
  ) then
    alter table public.sumsub_webhook_events
      add constraint sumsub_webhook_events_attempt_count_check
      check (attempt_count >= 1);
  end if;
end
$$;

create index if not exists sumsub_webhook_events_status_idx
  on public.sumsub_webhook_events(status, updated_at desc);

comment on column public.sumsub_webhook_events.status is
  'Durable Sumsub webhook lease state: processing, processed or failed.';

comment on column public.sumsub_webhook_events.attempt_count is
  'Monotonic Sumsub webhook lease generation used to fence stale workers.';

comment on column public.sumsub_webhook_events.updated_at is
  'Timestamp used to detect stale Sumsub webhook processing leases.';
