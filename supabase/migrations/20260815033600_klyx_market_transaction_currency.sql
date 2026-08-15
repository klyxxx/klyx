-- ============================================================
-- KLYX PHASE 5B
-- MARKET TRANSACTION CURRENCY
-- ============================================================
--
-- Nouvelle règle :
-- - une demande marché possède son pays + sa devise snapshot ;
-- - une offre utilise exactement la devise de sa demande ;
-- - aucune conversion FX silencieuse ;
-- - les données transactionnelles historiques restent intactes.
--
-- KLYX_MARKET_TRANSACTION_CURRENCY_PHASE_5B
-- ============================================================

begin;

-- ============================================================
-- 1. LEGACY PROFILE COMPATIBILITY
-- ============================================================
--
-- Les profils créés avant l'introduction des marchés KLYX
-- étaient implicitement dans le marché Belgique / EUR.
--
-- On ne touche qu'aux profils dont LES DEUX valeurs sont nulles.
-- Les profils déjà configurés ne sont jamais modifiés.
-- ============================================================

update public.profiles
set
  country_code = 'BE',
  currency_code = 'EUR'
where
  country_code is null
  and currency_code is null;

-- ============================================================
-- 2. MARKET REQUEST SNAPSHOT
-- ============================================================

alter table public.market_service_requests
  add column if not exists country_code text;

alter table public.market_service_requests
  add column if not exists currency text;

comment on column
  public.market_service_requests.country_code
is
  'KLYX market request country snapshot.';

comment on column
  public.market_service_requests.currency
is
  'ISO 4217 currency snapshot for the market request. No silent FX.';

-- ============================================================
-- 3. MARKET OFFER SNAPSHOT
-- ============================================================

alter table public.market_service_offers
  add column if not exists country_code text;

alter table public.market_service_offers
  add column if not exists currency text;

comment on column
  public.market_service_offers.country_code
is
  'Country snapshot inherited from the KLYX market request.';

comment on column
  public.market_service_offers.currency
is
  'ISO 4217 currency inherited from the KLYX market request.';

-- ============================================================
-- 4. SAFE BACKFILL
-- ============================================================

update public.market_service_requests as request
set
  country_code =
    coalesce(
      request.country_code,
      profile.country_code
    ),
  currency =
    coalesce(
      request.currency,
      profile.currency_code
    )
from public.profiles as profile
where
  profile.id =
    request.client_profile_id
  and (
    request.country_code is null
    or request.currency is null
  );

update public.market_service_offers as offer
set
  country_code =
    coalesce(
      offer.country_code,
      request.country_code
    ),
  currency =
    coalesce(
      offer.currency,
      request.currency
    )
from public.market_service_requests as request
where
  request.id =
    offer.request_id
  and (
    offer.country_code is null
    or offer.currency is null
  );

-- ============================================================
-- 5. FORMAT CONSTRAINTS
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where
      conname =
        'market_service_requests_country_phase5_check'
      and conrelid =
        'public.market_service_requests'::regclass
  ) then

    alter table
      public.market_service_requests
    add constraint
      market_service_requests_country_phase5_check
    check (
      country_code ~ '^[A-Z]{2}$'
    )
    not valid;

  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where
      conname =
        'market_service_requests_currency_phase5_check'
      and conrelid =
        'public.market_service_requests'::regclass
  ) then

    alter table
      public.market_service_requests
    add constraint
      market_service_requests_currency_phase5_check
    check (
      currency ~ '^[A-Z]{3}$'
    )
    not valid;

  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where
      conname =
        'market_service_offers_country_phase5_check'
      and conrelid =
        'public.market_service_offers'::regclass
  ) then

    alter table
      public.market_service_offers
    add constraint
      market_service_offers_country_phase5_check
    check (
      country_code ~ '^[A-Z]{2}$'
    )
    not valid;

  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where
      conname =
        'market_service_offers_currency_phase5_check'
      and conrelid =
        'public.market_service_offers'::regclass
  ) then

    alter table
      public.market_service_offers
    add constraint
      market_service_offers_currency_phase5_check
    check (
      currency ~ '^[A-Z]{3}$'
    )
    not valid;

  end if;
end;
$$;

-- ============================================================
-- 6. REQUEST CURRENCY GUARD
-- ============================================================

create or replace function
  public.klyx_market_request_currency_guard_phase5()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  profile_country text;
  profile_currency text;
begin

  if
    tg_op = 'UPDATE'
    and new.client_profile_id
      is distinct from
      old.client_profile_id
  then
    raise exception
      'KLYX_MARKET_REQUEST_OWNER_IMMUTABLE';
  end if;

  if tg_op = 'UPDATE' then

    if
      old.country_code is not null
      and new.country_code
        is distinct from
        old.country_code
    then
      raise exception
        'KLYX_MARKET_REQUEST_COUNTRY_IMMUTABLE';
    end if;

    if
      old.currency is not null
      and new.currency
        is distinct from
        old.currency
    then
      raise exception
        'KLYX_MARKET_REQUEST_CURRENCY_IMMUTABLE';
    end if;

  end if;

  select
    upper(
      nullif(
        trim(profile.country_code),
        ''
      )
    ),
    upper(
      nullif(
        trim(profile.currency_code),
        ''
      )
    )
  into
    profile_country,
    profile_currency
  from public.profiles as profile
  where
    profile.id =
      new.client_profile_id;

  if
    profile_country is null
    or profile_currency is null
  then
    raise exception
      'KLYX_PROFILE_MARKET_REQUIRED';
  end if;

  if new.country_code is null then
    new.country_code :=
      profile_country;
  else
    new.country_code :=
      upper(
        trim(
          new.country_code
        )
      );
  end if;

  if new.currency is null then
    new.currency :=
      profile_currency;
  else
    new.currency :=
      upper(
        trim(
          new.currency
        )
      );
  end if;

  if
    new.country_code
      is distinct from
      profile_country
  then
    raise exception
      'KLYX_MARKET_REQUEST_COUNTRY_PROFILE_MISMATCH';
  end if;

  if
    new.currency
      is distinct from
      profile_currency
  then
    raise exception
      'KLYX_MARKET_REQUEST_CURRENCY_PROFILE_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists
  klyx_market_request_currency_guard_phase5
on public.market_service_requests;

create trigger
  klyx_market_request_currency_guard_phase5
before insert or update of
  client_profile_id,
  country_code,
  currency
on public.market_service_requests
for each row
execute function
  public.klyx_market_request_currency_guard_phase5();

-- ============================================================
-- 7. OFFER CURRENCY GUARD
-- ============================================================

create or replace function
  public.klyx_market_offer_currency_guard_phase5()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  request_country text;
  request_currency text;
begin

  if
    tg_op = 'UPDATE'
    and new.request_id
      is distinct from
      old.request_id
  then
    raise exception
      'KLYX_MARKET_OFFER_REQUEST_IMMUTABLE';
  end if;

  if tg_op = 'UPDATE' then

    if
      old.country_code is not null
      and new.country_code
        is distinct from
        old.country_code
    then
      raise exception
        'KLYX_MARKET_OFFER_COUNTRY_IMMUTABLE';
    end if;

    if
      old.currency is not null
      and new.currency
        is distinct from
        old.currency
    then
      raise exception
        'KLYX_MARKET_OFFER_CURRENCY_IMMUTABLE';
    end if;

  end if;

  select
    request.country_code,
    request.currency
  into
    request_country,
    request_currency
  from public.market_service_requests
    as request
  where
    request.id =
      new.request_id;

  if
    request_country is null
    or request_currency is null
  then
    raise exception
      'KLYX_MARKET_REQUEST_CURRENCY_REQUIRED';
  end if;

  if new.country_code is null then
    new.country_code :=
      request_country;
  else
    new.country_code :=
      upper(
        trim(
          new.country_code
        )
      );
  end if;

  if new.currency is null then
    new.currency :=
      request_currency;
  else
    new.currency :=
      upper(
        trim(
          new.currency
        )
      );
  end if;

  if
    new.country_code
      is distinct from
      request_country
  then
    raise exception
      'KLYX_MARKET_OFFER_COUNTRY_MISMATCH';
  end if;

  if
    new.currency
      is distinct from
      request_currency
  then
    raise exception
      'KLYX_MARKET_OFFER_CURRENCY_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists
  klyx_market_offer_currency_guard_phase5
on public.market_service_offers;

create trigger
  klyx_market_offer_currency_guard_phase5
before insert or update of
  request_id,
  country_code,
  currency
on public.market_service_offers
for each row
execute function
  public.klyx_market_offer_currency_guard_phase5();

-- ============================================================
-- 8. REQUIRE SNAPSHOT WHEN CURRENT DATA ALLOWS IT
-- ============================================================

do $$
begin

  if not exists (
    select 1
    from public.market_service_requests
    where
      country_code is null
      or currency is null
  ) then

    alter table
      public.market_service_requests
    alter column
      country_code
    set not null;

    alter table
      public.market_service_requests
    alter column
      currency
    set not null;

  end if;

end;
$$;

do $$
begin

  if not exists (
    select 1
    from public.market_service_offers
    where
      country_code is null
      or currency is null
  ) then

    alter table
      public.market_service_offers
    alter column
      country_code
    set not null;

    alter table
      public.market_service_offers
    alter column
      currency
    set not null;

  end if;

end;
$$;

-- ============================================================
-- 9. VALIDATE CONSTRAINTS
-- ============================================================

alter table
  public.market_service_requests
validate constraint
  market_service_requests_country_phase5_check;

alter table
  public.market_service_requests
validate constraint
  market_service_requests_currency_phase5_check;

alter table
  public.market_service_offers
validate constraint
  market_service_offers_country_phase5_check;

alter table
  public.market_service_offers
validate constraint
  market_service_offers_currency_phase5_check;

commit;

-- ============================================================
-- VERIFICATION
-- ============================================================

select
  table_name,
  column_name,
  is_nullable
from information_schema.columns
where
  table_schema = 'public'
  and table_name in (
    'market_service_requests',
    'market_service_offers'
  )
  and column_name in (
    'country_code',
    'currency'
  )
order by
  table_name,
  column_name;

select
  count(*) as profiles_without_market
from public.profiles
where
  country_code is null
  or currency_code is null;

select
  count(*) as market_requests_without_currency
from public.market_service_requests
where
  country_code is null
  or currency is null;

select
  count(*) as market_offers_without_currency
from public.market_service_offers
where
  country_code is null
  or currency is null;