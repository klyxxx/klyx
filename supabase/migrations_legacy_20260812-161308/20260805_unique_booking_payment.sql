begin;

-- Une réservation ne peut posséder qu'un seul paiement actif à la fois.
-- Le numéro de tentative ne change qu'après l'expiration définitive d'une
-- ancienne session Stripe. Les nouvelles requêtes concurrentes réutilisent
-- donc toujours la même clé d'idempotence.
alter table public.bookings
  add column if not exists payment_attempt_token uuid,
  add column if not exists payment_attempt_number integer not null default 0,
  add column if not exists payment_checkout_started_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_payment_attempt_number_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_payment_attempt_number_check
      check (payment_attempt_number >= 0);
  end if;
end;
$$;

-- Les anciennes colonnes peuvent contenir une chaîne vide. Elle ne représente
-- aucune session et doit rester équivalente à NULL avant les index uniques.
update public.bookings
set stripe_checkout_session_id = null
where btrim(coalesce(stripe_checkout_session_id, '')) = '';

update public.bookings
set stripe_payment_intent_id = null
where btrim(coalesce(stripe_payment_intent_id, '')) = '';

create unique index if not exists bookings_stripe_checkout_session_unique
  on public.bookings(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists bookings_stripe_payment_intent_unique
  on public.bookings(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- Une transition depuis "paid" vers un état payable est interdite, même si
-- une route ou une future interface contient une erreur.
create or replace function public.klyx_protect_paid_booking()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.payment_status = 'paid' then
    if new.payment_status is distinct from 'paid' then
      raise exception 'KLYX_BOOKING_ALREADY_PAID';
    end if;

    if new.amount_total is distinct from old.amount_total
      or new.currency is distinct from old.currency
      or new.stripe_checkout_session_id is distinct from old.stripe_checkout_session_id
      or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
    then
      raise exception 'KLYX_PAID_BOOKING_IMMUTABLE';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists klyx_protect_paid_booking on public.bookings;
create trigger klyx_protect_paid_booking
before update on public.bookings
for each row execute function public.klyx_protect_paid_booking();

-- Décide atomiquement si la route doit créer, reprendre ou refuser un
-- paiement. Le verrou de ligne empêche deux clics simultanés de gagner.
create or replace function public.klyx_claim_booking_payment(
  p_booking_id uuid,
  p_client_profile_id uuid,
  p_attempt_token uuid
)
returns table (
  action text,
  checkout_session_id text,
  attempt_number integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  booking_row public.bookings%rowtype;
  next_attempt_number integer;
begin
  select *
  into booking_row
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'KLYX_BOOKING_NOT_FOUND';
  end if;

  if booking_row.parent_id <> p_client_profile_id then
    raise exception 'KLYX_PAYMENT_ACCESS_DENIED';
  end if;

  if booking_row.status <> 'accepted' then
    raise exception 'KLYX_BOOKING_NOT_ACCEPTED';
  end if;

  if booking_row.payment_status = 'paid' then
    return query select
      'paid'::text,
      booking_row.stripe_checkout_session_id,
      booking_row.payment_attempt_number;
    return;
  end if;

  if booking_row.payment_status = 'checkout_created'
    and booking_row.stripe_checkout_session_id is not null
  then
    return query select
      'reuse'::text,
      booking_row.stripe_checkout_session_id,
      booking_row.payment_attempt_number;
    return;
  end if;

  if booking_row.payment_status = 'creating_checkout'
    and booking_row.payment_checkout_started_at > now() - interval '2 minutes'
  then
    return query select
      'busy'::text,
      null::text,
      booking_row.payment_attempt_number;
    return;
  end if;

  -- Après un délai réseau, on conserve le même numéro de tentative : Stripe
  -- renverra la session déjà créée grâce à la même clé d'idempotence.
  if booking_row.payment_status = 'creating_checkout' then
    next_attempt_number := greatest(booking_row.payment_attempt_number, 1);
  else
    next_attempt_number := booking_row.payment_attempt_number + 1;
  end if;

  update public.bookings
  set
    payment_status = 'creating_checkout',
    payment_attempt_token = p_attempt_token,
    payment_attempt_number = next_attempt_number,
    payment_checkout_started_at = now(),
    updated_at = now()
  where id = p_booking_id;

  return query select
    'create'::text,
    null::text,
    next_attempt_number;
end;
$$;

-- Une session Stripe expirée ne peut plus être payée. Elle seule autorise la
-- création d'une nouvelle tentative avec une nouvelle clé d'idempotence.
create or replace function public.klyx_release_expired_booking_checkout(
  p_booking_id uuid,
  p_checkout_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  booking_row public.bookings%rowtype;
begin
  select *
  into booking_row
  from public.bookings
  where id = p_booking_id
  for update;

  if not found
    or booking_row.payment_status = 'paid'
    or booking_row.stripe_checkout_session_id is distinct from p_checkout_session_id
  then
    return false;
  end if;

  update public.bookings
  set
    payment_status = 'failed',
    stripe_checkout_session_id = null,
    payment_attempt_token = null,
    payment_checkout_started_at = null,
    updated_at = now()
  where id = p_booking_id;

  return true;
end;
$$;

-- Le navigateur ne peut jamais appeler directement les fonctions de paiement.
revoke all on function public.klyx_claim_booking_payment(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_release_expired_booking_checkout(uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_protect_paid_booking()
  from public;

grant execute on function public.klyx_claim_booking_payment(uuid, uuid, uuid)
  to service_role;
grant execute on function public.klyx_release_expired_booking_checkout(uuid, text)
  to service_role;

commit;
