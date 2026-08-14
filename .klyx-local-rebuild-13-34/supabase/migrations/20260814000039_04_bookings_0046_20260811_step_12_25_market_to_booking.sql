-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations_legacy_20260812-161308\20260811_step_12_25_market_to_booking.sql
-- SHA256: 2a832fdf11b298e9375b3dd4b8631c15a48c1e1118647e09de2630a0f77ef3f9
-- PHASE: 04_bookings
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
begin;

alter table public.service_quotes
add column if not exists market_request_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_quotes_market_request_id_fkey'
  ) then
    alter table public.service_quotes
    add constraint service_quotes_market_request_id_fkey
    foreign key (market_request_id)
    references public.market_service_requests(id)
    on delete set null;
  end if;
end
$$;

create unique index if not exists service_quotes_market_request_id_unique
  on public.service_quotes(market_request_id)
  where market_request_id is not null;

create index if not exists service_quotes_market_request_id_idx
  on public.service_quotes(market_request_id);

notify pgrst, 'reload schema';

commit;
