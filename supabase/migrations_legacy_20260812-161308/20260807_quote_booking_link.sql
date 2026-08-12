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
