-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations_legacy_20260812-161308\20260811_step_12_27_market_notifications.sql
-- SHA256: 12c0cf030952a2c252a3407d23611dbeed094518066ffb8fb104fb8f8c5ff9a3
-- PHASE: 04_bookings
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
begin;

alter table public.user_notifications
  alter column booking_id drop not null;

alter table public.user_notifications
  add column if not exists market_request_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_notifications_market_request_id_fkey'
  ) then
    alter table public.user_notifications
      add constraint user_notifications_market_request_id_fkey
      foreign key (market_request_id)
      references public.market_service_requests(id)
      on delete set null;
  end if;
end
$$;

create index if not exists user_notifications_market_request_id_idx
  on public.user_notifications(market_request_id);

notify pgrst, 'reload schema';

commit;