-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations_legacy_20260812-161308\20260807_quote_booking_link.sql
-- SHA256: 184dac2058ce9017bc9fa3f535b8d6f515e72d12579082054e57b970f6e99266
-- PHASE: 04_bookings
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
begin;

alter table public.bookings
add column if not exists quote_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_quote_id_fkey'
  ) then
    alter table public.bookings
    add constraint bookings_quote_id_fkey
    foreign key (quote_id)
    references public.service_quotes(id)
    on delete set null;
  end if;
end
$$;

create unique index if not exists bookings_quote_id_unique
  on public.bookings(quote_id)
  where quote_id is not null;

create index if not exists bookings_quote_id_idx
  on public.bookings(quote_id);

notify pgrst, 'reload schema';

commit;
