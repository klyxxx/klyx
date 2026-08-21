-- ============================================================
-- KLYX UNIVERSAL BOOKING TRANSACTION SCHEMA
-- ============================================================
-- Align the fresh canonical database with the current quote and booking APIs.
-- Additive + idempotent. Existing transaction rows are preserved.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Transaction market snapshots
-- ------------------------------------------------------------
-- Old quotes/bookings remain valid historical rows. The application already
-- treats missing quote snapshots as legacy data that must not silently cross
-- currencies, so these columns intentionally remain nullable for old records.

alter table public.service_quotes
  add column if not exists country_code text;

alter table public.service_quotes
  add column if not exists currency text;

alter table public.bookings
  add column if not exists country_code text;

comment on column public.service_quotes.country_code is
  'ISO 3166-1 alpha-2 country snapshot captured when the KLYX quote is created.';

comment on column public.service_quotes.currency is
  'ISO 4217 transaction currency snapshot captured when the KLYX quote is created.';

comment on column public.bookings.country_code is
  'ISO 3166-1 alpha-2 country snapshot captured when the KLYX booking is created.';

-- ------------------------------------------------------------
-- 2. Universal booking availability guard
-- ------------------------------------------------------------
-- The historical baseline validated only the babysitting slug. Current KLYX
-- booking APIs are service-universal and always write user_service_id. Prefer
-- that exact service binding; retain the historical babysitting fallback only
-- for legacy rows that do not carry user_service_id.

create or replace function public.validate_booking_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_day integer;
  matching_slot_exists boolean;
  provider_profile_id uuid;
begin
  provider_profile_id :=
    coalesce(new.provider_id, new.babysitter_id);

  if provider_profile_id is null then
    raise exception 'KLYX_BOOKING_PROVIDER_REQUIRED';
  end if;

  if new.parent_id = provider_profile_id then
    raise exception 'Vous ne pouvez pas réserver votre propre profil.';
  end if;

  booking_day :=
    extract(dow from new.booking_date)::integer;

  if new.user_service_id is not null then
    select exists (
      select 1
      from public.user_services us
      join public.availability_slots a
        on a.user_service_id = us.id
      where us.id = new.user_service_id
        and us.user_id = provider_profile_id
        and us.active = true
        and coalesce(us.provider_enabled, true) = true
        and a.is_active = true
        and a.day_of_week = booking_day
        and new.start_time >= a.start_time
        and new.end_time <= a.end_time
    )
    into matching_slot_exists;
  else
    -- Compatibility path for historical babysitting rows created before
    -- user_service_id became part of the booking contract.
    select exists (
      select 1
      from public.user_services us
      join public.services s
        on s.id = us.service_id
      join public.availability_slots a
        on a.user_service_id = us.id
      where us.user_id = provider_profile_id
        and us.active = true
        and coalesce(us.provider_enabled, true) = true
        and s.slug in ('babysitting', 'baby-sitting')
        and a.is_active = true
        and a.day_of_week = booking_day
        and new.start_time >= a.start_time
        and new.end_time <= a.end_time
    )
    into matching_slot_exists;
  end if;

  if not coalesce(matching_slot_exists, false) then
    raise exception 'Ce créneau est en dehors des disponibilités du prestataire.';
  end if;

  return new;
end;
$$;

commit;
