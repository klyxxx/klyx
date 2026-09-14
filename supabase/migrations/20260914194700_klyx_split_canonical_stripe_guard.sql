-- ============================================================
-- KLYX SPLIT PAYOUT CANONICAL STRIPE GUARD
--
-- Split-payment snapshots keep their immutable Stripe destination for audit,
-- but every persisted/claimed payment unit must still match the canonical
-- account-level Connect identity at execution time.
-- ============================================================

begin;

create or replace function public.klyx_assert_canonical_split_stripe_identity(
  p_provider_profile_id uuid,
  p_stripe_account_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_account_id uuid;
  v_canonical_stripe_account_id text;
  v_state text;
begin
  select profile.account_id
  into v_account_id
  from public.profiles as profile
  where profile.id = p_provider_profile_id;

  if v_account_id is null then
    raise exception using
      errcode = '23514',
      message = 'KLYX_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED';
  end if;

  select
    account.stripe_account_id,
    account.stripe_connect_state
  into
    v_canonical_stripe_account_id,
    v_state
  from public.accounts as account
  where account.id = v_account_id;

  if v_state is distinct from 'linked'
     or v_canonical_stripe_account_id is null
     or p_stripe_account_id is distinct from v_canonical_stripe_account_id then
    raise exception using
      errcode = '23514',
      message = 'KLYX_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED';
  end if;
end;
$function$;

alter function public.klyx_assert_canonical_split_stripe_identity(uuid, text)
  owner to postgres;
revoke all on function public.klyx_assert_canonical_split_stripe_identity(uuid, text)
  from public, anon, authenticated;
grant execute on function public.klyx_assert_canonical_split_stripe_identity(uuid, text)
  to service_role;

create or replace function public.klyx_guard_split_unit_canonical_stripe()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  perform public.klyx_assert_canonical_split_stripe_identity(
    new.provider_profile_id,
    new.stripe_account_id
  );

  return new;
end;
$function$;

alter function public.klyx_guard_split_unit_canonical_stripe()
  owner to postgres;

revoke all on function public.klyx_guard_split_unit_canonical_stripe()
  from public, anon, authenticated;
grant execute on function public.klyx_guard_split_unit_canonical_stripe()
  to service_role;

drop trigger if exists klyx_split_unit_canonical_stripe_guard
  on public.split_booking_payment_units;

create trigger klyx_split_unit_canonical_stripe_guard
before insert or update of provider_profile_id, stripe_account_id
on public.split_booking_payment_units
for each row
execute function public.klyx_guard_split_unit_canonical_stripe();

-- Existing units, including units created before this migration, are rechecked
-- under the row lock immediately before a new/reused Checkout can proceed.
create or replace function public.klyx_claim_split_payment_unit_13_27(
  p_unit_id uuid,
  p_client_profile_id uuid,
  p_attempt_token text
)
returns table (
  action text,
  unit_id uuid,
  checkout_session_id text,
  attempt_number integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_unit public.split_booking_payment_units%rowtype;
begin
  select *
  into v_unit
  from public.split_booking_payment_units
  where
    id = p_unit_id
    and client_profile_id = p_client_profile_id
  for update;

  if not found then
    raise exception 'KLYX_SPLIT_PAYMENT_UNIT_NOT_FOUND';
  end if;

  perform public.klyx_assert_canonical_split_stripe_identity(
    v_unit.provider_profile_id,
    v_unit.stripe_account_id
  );

  if v_unit.status = 'paid' then
    return query
    select
      'paid'::text,
      v_unit.id,
      v_unit.stripe_checkout_session_id,
      v_unit.attempt_number;
    return;
  end if;

  if
    v_unit.status = 'checkout_open'
    and v_unit.stripe_checkout_session_id is not null
  then
    return query
    select
      'reuse'::text,
      v_unit.id,
      v_unit.stripe_checkout_session_id,
      v_unit.attempt_number;
    return;
  end if;

  if
    v_unit.status = 'creating'
    and v_unit.updated_at > now() - interval '2 minutes'
  then
    return query
    select
      'busy'::text,
      v_unit.id,
      v_unit.stripe_checkout_session_id,
      v_unit.attempt_number;
    return;
  end if;

  update public.split_booking_payment_units
  set
    status = 'creating',
    attempt_number = attempt_number + 1,
    attempt_token = p_attempt_token,
    last_error = null,
    updated_at = now()
  where id = v_unit.id
  returning * into v_unit;

  return query
  select
    'create'::text,
    v_unit.id,
    null::text,
    v_unit.attempt_number;
end;
$function$;

alter function public.klyx_claim_split_payment_unit_13_27(uuid, uuid, text)
  owner to postgres;
revoke all on function public.klyx_claim_split_payment_unit_13_27(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.klyx_claim_split_payment_unit_13_27(uuid, uuid, text)
  to service_role;

-- Verification is deliberately read-only and migration-safe.
do $klyx_split_canonical_verify$
begin
  if exists (
    select 1
    from public.split_booking_payment_units as unit
    join public.profiles as profile
      on profile.id = unit.provider_profile_id
    left join public.accounts as account
      on account.id = profile.account_id
    where account.id is null
       or account.stripe_connect_state is distinct from 'linked'
       or account.stripe_account_id is null
       or unit.stripe_account_id is distinct from account.stripe_account_id
  ) then
    raise exception 'KLYX_SPLIT_CANONICAL_STRIPE_EXISTING_CONFLICT';
  end if;
end;
$klyx_split_canonical_verify$;

commit;
