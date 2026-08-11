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
