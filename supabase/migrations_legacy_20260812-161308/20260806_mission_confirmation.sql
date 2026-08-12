begin;

alter table public.bookings
  add column if not exists provider_finished_at timestamp with time zone null,
  add column if not exists provider_finish_note text null,
  add column if not exists client_confirmed_at timestamp with time zone null;

create index if not exists bookings_provider_finished_idx
  on public.bookings (provider_finished_at)
  where provider_finished_at is not null
    and client_confirmed_at is null;

commit;
