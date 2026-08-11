begin;

create table if not exists public.market_service_requests (
  id uuid primary key default gen_random_uuid(),
  client_profile_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  title text not null,
  description text not null,
  city text not null,
  requested_date date null,
  requested_time time without time zone null,
  budget_max numeric(12,2) null,
  status text not null default 'open'
    check (status in ('open', 'matched', 'cancelled', 'closed')),
  accepted_offer_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.market_service_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.market_service_requests(id) on delete cascade,
  provider_profile_id uuid not null references public.profiles(id) on delete cascade,
  user_service_id uuid not null references public.user_services(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0 and amount <= 1000000),
  message text null,
  status text not null default 'sent'
    check (status in ('sent', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, provider_profile_id)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'market_service_requests_accepted_offer_id_fkey'
  ) then
    alter table public.market_service_requests
      add constraint market_service_requests_accepted_offer_id_fkey
      foreign key (accepted_offer_id)
      references public.market_service_offers(id)
      on delete set null;
  end if;
end $$;

create index if not exists market_requests_client_idx
  on public.market_service_requests(client_profile_id, created_at desc);

create index if not exists market_requests_service_status_idx
  on public.market_service_requests(service_id, status, created_at desc);

create index if not exists market_offers_request_idx
  on public.market_service_offers(request_id, created_at desc);

create index if not exists market_offers_provider_idx
  on public.market_service_offers(provider_profile_id, created_at desc);

alter table public.market_service_requests enable row level security;
alter table public.market_service_offers enable row level security;

drop policy if exists "Clients read own market requests"
  on public.market_service_requests;

create policy "Clients read own market requests"
  on public.market_service_requests
  for select to authenticated
  using (
    client_profile_id in (
      select id from public.profiles
      where owner_user_id = auth.uid()
        and account_type = 'client'
    )
  );

drop policy if exists "Providers read open market requests"
  on public.market_service_requests;

create policy "Providers read open market requests"
  on public.market_service_requests
  for select to authenticated
  using (
    status = 'open'
    and exists (
      select 1 from public.profiles
      where owner_user_id = auth.uid()
        and account_type = 'provider'
    )
  );

drop policy if exists "Clients read offers on own requests"
  on public.market_service_offers;

create policy "Clients read offers on own requests"
  on public.market_service_offers
  for select to authenticated
  using (
    exists (
      select 1
      from public.market_service_requests request
      join public.profiles profile
        on profile.id = request.client_profile_id
      where request.id = market_service_offers.request_id
        and profile.owner_user_id = auth.uid()
        and profile.account_type = 'client'
    )
  );

drop policy if exists "Providers read own market offers"
  on public.market_service_offers;

create policy "Providers read own market offers"
  on public.market_service_offers
  for select to authenticated
  using (
    provider_profile_id in (
      select id from public.profiles
      where owner_user_id = auth.uid()
        and account_type = 'provider'
    )
  );

notify pgrst, 'reload schema';

commit;
