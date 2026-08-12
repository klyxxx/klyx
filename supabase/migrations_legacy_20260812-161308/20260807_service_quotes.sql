begin;

create table if not exists public.service_quotes (
  id uuid primary key default gen_random_uuid(),
  client_profile_id uuid not null references public.profiles(id) on delete cascade,
  provider_profile_id uuid not null references public.profiles(id) on delete cascade,
  user_service_id uuid not null references public.user_services(id) on delete cascade,

  title text not null,
  description text not null,

  requested_date date null,
  requested_time time without time zone null,
  duration_hours numeric(6,2) null,

  pricing_type text not null,
  unit_price numeric(12,2) null,
  quantity numeric(8,2) not null default 1,
  estimated_total numeric(12,2) null,

  provider_price numeric(12,2) null,
  provider_message text null,

  status text not null default 'requested',

  expires_at timestamp with time zone null,
  accepted_at timestamp with time zone null,
  rejected_at timestamp with time zone null,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint service_quotes_profiles_different
    check (client_profile_id <> provider_profile_id),

  constraint service_quotes_pricing_type_check
    check (pricing_type in ('hourly', 'fixed')),

  constraint service_quotes_status_check
    check (
      status in (
        'requested',
        'sent',
        'accepted',
        'rejected',
        'cancelled',
        'expired'
      )
    ),

  constraint service_quotes_duration_check
    check (
      duration_hours is null
      or (
        duration_hours > 0
        and duration_hours <= 48
      )
    ),

  constraint service_quotes_quantity_check
    check (quantity > 0),

  constraint service_quotes_prices_check
    check (
      (unit_price is null or unit_price >= 0)
      and
      (estimated_total is null or estimated_total >= 0)
      and
      (provider_price is null or provider_price >= 0)
    )
);

create index if not exists service_quotes_client_idx
  on public.service_quotes(client_profile_id, created_at desc);

create index if not exists service_quotes_provider_idx
  on public.service_quotes(provider_profile_id, created_at desc);

create index if not exists service_quotes_status_idx
  on public.service_quotes(status, created_at desc);

alter table public.service_quotes enable row level security;

drop policy if exists "Clients read own quotes"
on public.service_quotes;

create policy "Clients read own quotes"
on public.service_quotes
for select
to authenticated
using (
  client_profile_id in (
    select id
    from public.profiles
    where owner_user_id = auth.uid()
      and account_type = 'client'
  )
);

drop policy if exists "Providers read own quotes"
on public.service_quotes;

create policy "Providers read own quotes"
on public.service_quotes
for select
to authenticated
using (
  provider_profile_id in (
    select id
    from public.profiles
    where owner_user_id = auth.uid()
      and account_type = 'provider'
  )
);

notify pgrst, 'reload schema';

commit;
