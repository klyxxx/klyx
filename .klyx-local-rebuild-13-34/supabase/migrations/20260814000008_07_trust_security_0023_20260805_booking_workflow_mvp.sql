-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations_legacy_20260812-161308\20260805_booking_workflow_mvp.sql
-- SHA256: 2466e9c2931dda461d78b8b2fe6c8e46e81d47cdb9f9a93ea2c019d315dba00c
-- PHASE: 07_trust_security
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
begin;

-- La réservation conserve le prix présenté au client au moment de la demande.
-- Une modification ultérieure du tarif du prestataire ne change donc jamais
-- une réservation déjà créée.
alter table public.bookings
  add column if not exists pricing_type_snapshot text,
  add column if not exists unit_price_cents integer,
  add column if not exists estimated_amount_cents integer,
  add column if not exists currency text not null default 'EUR',
  add column if not exists accepted_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null,
  add column if not exists cancellation_reason text,
  add column if not exists provider_response text,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_pricing_snapshot_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_pricing_snapshot_check
      check (
        pricing_type_snapshot is null
        or pricing_type_snapshot in ('hourly', 'fixed')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_price_amounts_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_price_amounts_check
      check (
        (unit_price_cents is null or unit_price_cents >= 0)
        and (estimated_amount_cents is null or estimated_amount_cents >= 0)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_currency_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_currency_check
      check (currency ~ '^[A-Z]{3}$');
  end if;
end;
$$;

create index if not exists bookings_provider_schedule_idx
  on public.bookings(provider_id, booking_date, start_time, end_time, status);

create index if not exists bookings_parent_schedule_idx
  on public.bookings(parent_id, booking_date, start_time, end_time, status);

-- Verrou transactionnel : deux demandes acceptées exactement au même moment
-- ne peuvent jamais réserver le même prestataire sur un créneau qui se croise.
create or replace function public.klyx_prevent_provider_booking_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  provider_profile_id uuid;
begin
  provider_profile_id := coalesce(new.provider_id, new.babysitter_id);

  if provider_profile_id is null or new.status not in ('accepted', 'completed') then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtext(provider_profile_id::text),
    hashtext(new.booking_date::text)
  );

  if exists (
    select 1
    from public.bookings existing
    where existing.id <> new.id
      and coalesce(existing.provider_id, existing.babysitter_id) = provider_profile_id
      and existing.booking_date = new.booking_date
      and existing.status in ('accepted', 'completed')
      and existing.start_time < new.end_time
      and existing.end_time > new.start_time
  ) then
    raise exception 'KLYX_PROVIDER_TIME_CONFLICT';
  end if;

  return new;
end;
$$;

drop trigger if exists klyx_prevent_provider_booking_overlap
  on public.bookings;
create trigger klyx_prevent_provider_booking_overlap
before insert or update of
  provider_id,
  babysitter_id,
  booking_date,
  start_time,
  end_time,
  status
on public.bookings
for each row execute function public.klyx_prevent_provider_booking_overlap();

-- Historique immuable des décisions prises sur une réservation.
create table if not exists public.booking_status_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  previous_status text,
  new_status text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint booking_status_events_status_check
    check (
      new_status in ('pending', 'accepted', 'rejected', 'cancelled', 'completed')
      and (
        previous_status is null
        or previous_status in ('pending', 'accepted', 'rejected', 'cancelled', 'completed')
      )
    )
);

create index if not exists booking_status_events_booking_created_idx
  on public.booking_status_events(booking_id, created_at);

-- Ajoute un événement initial aux anciennes réservations sans historique.
insert into public.booking_status_events (
  booking_id,
  actor_id,
  previous_status,
  new_status,
  note,
  created_at
)
select
  booking.id,
  booking.parent_id,
  null,
  case
    when booking.status in ('pending', 'accepted', 'rejected', 'cancelled', 'completed')
      then booking.status
    else 'pending'
  end,
  'Réservation importée dans le nouvel historique KLYX.',
  booking.created_at
from public.bookings booking
where not exists (
  select 1
  from public.booking_status_events event
  where event.booking_id = booking.id
);

alter table public.booking_status_events enable row level security;

grant select on public.booking_status_events to authenticated;

drop policy if exists "klyx_booking_status_events_select"
  on public.booking_status_events;
create policy "klyx_booking_status_events_select"
on public.booking_status_events
for select
to authenticated
using (public.klyx_owns_booking(booking_id));

-- L'application serveur enregistre les changements ; un utilisateur ne peut
-- pas fabriquer ou modifier son historique directement depuis le navigateur.
revoke insert, update, delete on public.booking_status_events
  from anon, authenticated;

revoke all on function public.klyx_prevent_provider_booking_overlap()
  from public;

commit;
