-- KLYX_MARKET_PROVIDER_NOTIFICATION_IDEMPOTENCY_16_21
--
-- Existing notifications remain compatible because PostgreSQL UNIQUE
-- constraints allow multiple NULL values. New market-provider deliveries
-- receive a deterministic idempotency key so retries cannot create spam.

alter table public.user_notifications
  add column if not exists idempotency_key text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_notifications_idempotency_key_key'
      and conrelid = 'public.user_notifications'::regclass
  ) then
    alter table public.user_notifications
      add constraint user_notifications_idempotency_key_key
      unique (idempotency_key);
  end if;
end
$$;

comment on column public.user_notifications.idempotency_key is
  'Server-generated idempotency key. Market provider notifications use market-provider:<request_id>:<provider_profile_id> so delivery can be retried safely.';
