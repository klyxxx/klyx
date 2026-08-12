-- KLYX 12.1
alter table public.service_profiles
  add column if not exists hourly_price numeric(10,2),
  add column if not exists fixed_price numeric(10,2);

update public.service_profiles
set
  hourly_price = case
    when pricing_type = 'hourly' and hourly_price is null then price
    else hourly_price
  end,
  fixed_price = case
    when pricing_type = 'fixed' and fixed_price is null then price
    else fixed_price
  end
where price is not null;

alter table public.service_profiles
  drop constraint if exists service_profiles_hourly_price_check;

alter table public.service_profiles
  add constraint service_profiles_hourly_price_check
  check (hourly_price is null or (hourly_price >= 1 and hourly_price <= 10000));

alter table public.service_profiles
  drop constraint if exists service_profiles_fixed_price_check;

alter table public.service_profiles
  add constraint service_profiles_fixed_price_check
  check (fixed_price is null or (fixed_price >= 1 and fixed_price <= 10000));
