-- KLYX Mission 1 production financial certification support.
--
-- Persist Stripe webhook delivery count without changing financial idempotency.
-- stripe_webhook_events remains the canonical webhook claim row.
-- This is operational evidence only: it never replays or mutates financial truth.

begin;

alter table public.stripe_webhook_events
  add column if not exists delivery_count integer,
  add column if not exists last_received_at timestamptz;

update public.stripe_webhook_events
   set delivery_count = coalesce(delivery_count, 1),
       last_received_at = coalesce(last_received_at, received_at)
 where delivery_count is null
    or last_received_at is null;

alter table public.stripe_webhook_events
  alter column delivery_count set default 1,
  alter column delivery_count set not null,
  alter column last_received_at set default now(),
  alter column last_received_at set not null;

alter table public.stripe_webhook_events
  drop constraint if exists stripe_webhook_events_delivery_count_check;

alter table public.stripe_webhook_events
  add constraint stripe_webhook_events_delivery_count_check
  check (delivery_count >= 1);

create or replace function public.klyx_record_stripe_webhook_redelivery(
  p_stripe_event_id text,
  p_received_at timestamptz default now()
)
returns table (
  stripe_event_id text,
  delivery_count integer,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(btrim(p_stripe_event_id), '') is null then
    raise exception 'KLYX_STRIPE_WEBHOOK_EVENT_ID_REQUIRED';
  end if;

  return query
  update public.stripe_webhook_events as e
     set delivery_count = e.delivery_count + 1,
         last_received_at = greatest(e.last_received_at, p_received_at),
         updated_at = greatest(e.updated_at, p_received_at)
   where e.stripe_event_id = p_stripe_event_id
  returning e.stripe_event_id, e.delivery_count, e.status;

  if not found then
    raise exception 'KLYX_STRIPE_WEBHOOK_REDELIVERY_EVENT_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.klyx_record_stripe_webhook_redelivery(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.klyx_record_stripe_webhook_redelivery(text, timestamptz)
  to service_role;

comment on column public.stripe_webhook_events.delivery_count is
  'Observed deliveries for the immutable Stripe event id. Financial processing remains idempotent and separate.';
comment on column public.stripe_webhook_events.last_received_at is
  'Latest observed delivery timestamp for this Stripe event id.';
comment on function public.klyx_record_stripe_webhook_redelivery(text, timestamptz) is
  'Records duplicate/redelivered webhook evidence only. It does not authorize or replay financial effects.';

commit;
