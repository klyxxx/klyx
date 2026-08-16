-- ============================================================
-- KLYX 14.23
-- TRANSACTION CURRENCY DATABASE FOUNDATION
-- ============================================================
--
-- Objectifs :
-- - ajouter le snapshot marche/devise aux devis ;
-- - ajouter le pays transactionnel aux reservations/groupes ;
-- - conserver les anciennes donnees sans reinterpretation ;
-- - bloquer les changements silencieux de devise ;
-- - garantir la coherence devis -> reservation -> groupe.
--
-- IMPORTANT :
-- Aucun paiement.
-- Aucun taux de change.
-- Aucune reecriture monetaire historique.
-- ============================================================

begin;

-- KLYX_TRANSACTION_CURRENCY_DB_14_23

-- ============================================================
-- 1. SERVICE QUOTES
-- ============================================================

alter table public.service_quotes
  add column if not exists country_code text;

alter table public.service_quotes
  add column if not exists currency text;

-- KLYX_QUOTE_CURRENCY_SNAPSHOT_14_23

comment on column public.service_quotes.country_code is
  'KLYX transaction country snapshot. Nullable only for legacy quotes created before market-aware transactions.';

comment on column public.service_quotes.currency is
  'ISO 4217 transaction currency snapshot. No silent FX conversion.';

-- ============================================================
-- 2. BOOKINGS
-- ============================================================
--
-- bookings.currency existe deja dans KLYX.
-- On NE cree PAS une seconde colonne currency_code.
-- On ajoute uniquement le pays qui explique cette devise.
-- ============================================================

alter table public.bookings
  add column if not exists country_code text;

-- KLYX_BOOKING_MARKET_SNAPSHOT_14_23

comment on column public.bookings.country_code is
  'KLYX transaction country snapshot associated with bookings.currency.';

comment on column public.bookings.currency is
  'ISO 4217 transaction currency snapshot. Must remain immutable once assigned.';

-- ============================================================
-- 3. BOOKING GROUPS
-- ============================================================

alter table public.booking_groups
  add column if not exists country_code text;

-- KLYX_BOOKING_GROUP_MARKET_SNAPSHOT_14_23

comment on column public.booking_groups.country_code is
  'KLYX transaction country snapshot associated with booking_groups.currency.';

comment on column public.booking_groups.currency is
  'ISO 4217 transaction currency snapshot. No silent conversion between providers or bookings.';

-- ============================================================
-- 4. FORMAT CONSTRAINTS
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'service_quotes_country_code_14_23_check'
      and conrelid = 'public.service_quotes'::regclass
  ) then
    alter table public.service_quotes
      add constraint service_quotes_country_code_14_23_check
      check (
        country_code is null
        or country_code ~ '^[A-Z]{2}$'
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'service_quotes_currency_14_23_check'
      and conrelid = 'public.service_quotes'::regclass
  ) then
    alter table public.service_quotes
      add constraint service_quotes_currency_14_23_check
      check (
        currency is null
        or currency ~ '^[A-Z]{3}$'
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'bookings_country_code_14_23_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_country_code_14_23_check
      check (
        country_code is null
        or country_code ~ '^[A-Z]{2}$'
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'booking_groups_country_code_14_23_check'
      and conrelid = 'public.booking_groups'::regclass
  ) then
    alter table public.booking_groups
      add constraint booking_groups_country_code_14_23_check
      check (
        country_code is null
        or country_code ~ '^[A-Z]{2}$'
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'booking_groups_currency_14_23_check'
      and conrelid = 'public.booking_groups'::regclass
  ) then
    alter table public.booking_groups
      add constraint booking_groups_currency_14_23_check
      check (
        currency ~ '^[A-Z]{3}$'
      )
      not valid;
  end if;
end;
$$;

-- ============================================================
-- 5. CURRENCY IMMUTABILITY
-- ============================================================
--
-- Une devise deja attribuee a une transaction ne peut pas
-- etre transformee silencieusement en une autre devise.
--
-- Legacy :
-- NULL -> EUR/CAD/USD/... reste autorise une seule fois afin
-- que KLYX puisse hydrater les anciennes lignes plus tard.
-- ============================================================

-- KLYX_CURRENCY_IMMUTABLE_14_23

create or replace function
  public.klyx_guard_transaction_currency_14_23()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if
      old.currency is not null
      and new.currency is distinct from old.currency
    then
      raise exception
        'KLYX_TRANSACTION_CURRENCY_IMMUTABLE';
    end if;

    if
      old.country_code is not null
      and new.country_code is distinct from old.country_code
    then
      raise exception
        'KLYX_TRANSACTION_COUNTRY_IMMUTABLE';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists
  klyx_service_quotes_currency_lock_14_23
on public.service_quotes;

create trigger
  klyx_service_quotes_currency_lock_14_23
before update of currency, country_code
on public.service_quotes
for each row
execute function
  public.klyx_guard_transaction_currency_14_23();

drop trigger if exists
  klyx_bookings_currency_lock_14_23
on public.bookings;

create trigger
  klyx_bookings_currency_lock_14_23
before update of currency, country_code
on public.bookings
for each row
execute function
  public.klyx_guard_transaction_currency_14_23();

drop trigger if exists
  klyx_booking_groups_currency_lock_14_23
on public.booking_groups;

create trigger
  klyx_booking_groups_currency_lock_14_23
before update of currency, country_code
on public.booking_groups
for each row
execute function
  public.klyx_guard_transaction_currency_14_23();

-- ============================================================
-- 6. LINKED TRANSACTION CONSISTENCY
-- ============================================================
--
-- Une reservation liee a un devis ne peut pas changer
-- silencieusement de devise.
--
-- Une reservation d'un groupe doit utiliser exactement
-- la devise du groupe.
-- ============================================================

-- KLYX_LINKED_CURRENCY_MATCH_14_23

create or replace function
  public.klyx_validate_booking_currency_links_14_23()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  quote_currency text;
  group_currency text;
begin
  if new.quote_id is not null then
    select q.currency
    into quote_currency
    from public.service_quotes q
    where q.id = new.quote_id;

    if
      quote_currency is not null
      and new.currency is distinct from quote_currency
    then
      raise exception
        'KLYX_BOOKING_QUOTE_CURRENCY_MISMATCH';
    end if;
  end if;

  if new.booking_group_id is not null then
    select g.currency
    into group_currency
    from public.booking_groups g
    where g.id = new.booking_group_id;

    if
      group_currency is not null
      and new.currency is distinct from group_currency
    then
      raise exception
        'KLYX_BOOKING_GROUP_CURRENCY_MISMATCH';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists
  klyx_booking_currency_links_14_23
on public.bookings;

create trigger
  klyx_booking_currency_links_14_23
before insert or update of
  currency,
  quote_id,
  booking_group_id
on public.bookings
for each row
execute function
  public.klyx_validate_booking_currency_links_14_23();

-- ============================================================
-- 7. ABSENCE DE REECRITURE HISTORIQUE
-- ============================================================

-- KLYX_NO_CURRENCY_REWRITE_14_23
--
-- Aucun UPDATE massif vers EUR/USD/CAD n'est effectue ici.
-- Les transactions historiques conservent leur signification.
-- Le raccordement explicite des nouvelles transactions arrive
-- a l'etape API suivante.

commit;

-- ============================================================
-- VERIFICATION
-- ============================================================

select
  table_name,
  column_name,
  is_nullable,
  column_default
from information_schema.columns
where
  table_schema = 'public'
  and table_name in (
    'service_quotes',
    'bookings',
    'booking_groups'
  )
  and column_name in (
    'country_code',
    'currency'
  )
order by
  table_name,
  column_name;

select
  conrelid::regclass::text as table_name,
  conname as constraint_name
from pg_constraint
where conname in (
  'service_quotes_country_code_14_23_check',
  'service_quotes_currency_14_23_check',
  'bookings_country_code_14_23_check',
  'booking_groups_country_code_14_23_check',
  'booking_groups_currency_14_23_check'
)
order by conname;