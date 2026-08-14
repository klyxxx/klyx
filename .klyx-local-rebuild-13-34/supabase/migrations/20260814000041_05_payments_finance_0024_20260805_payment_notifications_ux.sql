-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations_legacy_20260812-161308\20260805_payment_notifications_ux.sql
-- SHA256: 07244533950a3f75d5f57ef895757521d7ac7cd6f8d7cf95aea0c9f809dc00b6
-- PHASE: 05_payments_finance
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
begin;

-- Les états techniques Stripe restent privés. L'interface affiche seulement
-- « À payer », le succès final ou le motif clair d'un refus.
alter table public.bookings
  add column if not exists payment_failure_code text,
  add column if not exists payment_failure_message text,
  add column if not exists payment_failed_at timestamptz;

-- Corrige aussi la contrainte de la migration précédente afin d'autoriser les
-- états internes nécessaires au verrou anti-double paiement.
alter table public.bookings
  drop constraint if exists bookings_payment_status_check;

alter table public.bookings
  add constraint bookings_payment_status_check
  check (
    payment_status in (
      'unpaid',
      'creating_checkout',
      'checkout_created',
      'paid',
      'failed',
      'refunded'
    )
  );

-- Une clé stable rend les notifications Stripe idempotentes : un webhook
-- répété ne crée jamais plusieurs notifications pour le même résultat.
alter table public.user_notifications
  add column if not exists deduplication_key text;

create unique index if not exists user_notifications_deduplication_key_unique
  on public.user_notifications(deduplication_key);

-- Réserve atomiquement le droit de créer ou réutiliser la session Stripe.
-- Les informations d'un ancien refus sont effacées uniquement lorsqu'une
-- nouvelle tentative réelle commence.
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
    stripe_checkout_session_id = case
      when booking_row.payment_status = 'creating_checkout'
        then booking_row.stripe_checkout_session_id
      else null
    end,
    stripe_payment_intent_id = case
      when booking_row.payment_status = 'creating_checkout'
        then booking_row.stripe_payment_intent_id
      else null
    end,
    payment_failure_code = null,
    payment_failure_message = null,
    payment_failed_at = null,
    updated_at = now()
  where id = p_booking_id;

  return query select
    'create'::text,
    null::text,
    next_attempt_number;
end;
$$;

-- Une session expirée est libérée sans laisser l'identifiant de son ancien
-- PaymentIntent bloquer la tentative suivante.
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
    stripe_payment_intent_id = null,
    payment_attempt_token = null,
    payment_checkout_started_at = null,
    payment_failure_code = null,
    payment_failure_message = null,
    payment_failed_at = null,
    updated_at = now()
  where id = p_booking_id;

  return true;
end;
$$;

revoke all on function public.klyx_claim_booking_payment(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_release_expired_booking_checkout(uuid, text)
  from public, anon, authenticated;

grant execute on function public.klyx_claim_booking_payment(uuid, uuid, uuid)
  to service_role;
grant execute on function public.klyx_release_expired_booking_checkout(uuid, text)
  to service_role;

-- La cloche du tableau de bord reçoit les nouvelles notifications sans qu'il
-- soit nécessaire d'actualiser la page.
do $$
begin
  begin
    alter publication supabase_realtime
      add table public.user_notifications;
  exception
    when duplicate_object or undefined_object then null;
  end;
end;
$$;

commit;
