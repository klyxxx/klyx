-- KLYX_BRAIN_PUBLISH_CONFIRMATION_IDEMPOTENCY_16_20
-- One explicit assistant confirmation may publish at most one market request.

alter table public.market_service_requests
  add column if not exists brain_confirmation_message_id uuid null;

create unique index if not exists market_service_requests_brain_confirmation_message_uidx
  on public.market_service_requests (brain_confirmation_message_id)
  where brain_confirmation_message_id is not null;

comment on column public.market_service_requests.brain_confirmation_message_id is
  'Explicit KLYX brain_messages confirmation consumed to publish this request. Unique to make assistant publication replay-safe.';
