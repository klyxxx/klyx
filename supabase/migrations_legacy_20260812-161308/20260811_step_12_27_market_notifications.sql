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