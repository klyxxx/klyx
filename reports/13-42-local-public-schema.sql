


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_attach_split_checkout_13_27"("p_unit_id" "uuid", "p_attempt_token" "text", "p_checkout_session_id" "text", "p_checkout_url" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update
    public.split_booking_payment_units
  set
    status = 'checkout_open',
    stripe_checkout_session_id =
      p_checkout_session_id,
    checkout_url =
      p_checkout_url,
    attempt_token = null,
    checkout_created_at = now(),
    updated_at = now()
  where
    id = p_unit_id
    and status = 'creating'
    and attempt_token =
      p_attempt_token;

  return found;
end;
$$;


ALTER FUNCTION "public"."klyx_attach_split_checkout_13_27"("p_unit_id" "uuid", "p_attempt_token" "text", "p_checkout_session_id" "text", "p_checkout_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_block_split_payment_reconfirmation_13_27"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if exists (
    select 1
    from public.split_booking_payment_runs
    where batch_id = new.batch_id
  ) then
    raise exception
      'KLYX_SPLIT_PAYMENT_ALREADY_STARTED';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."klyx_block_split_payment_reconfirmation_13_27"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_can_review"("booking_id" "uuid", "author_id" "uuid", "target_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.bookings booking
    where booking.id = booking_id
      and booking.parent_id = author_id
      and coalesce(booking.provider_id, booking.babysitter_id) = target_id
      and booking.status = 'completed'
  );
$$;


ALTER FUNCTION "public"."klyx_can_review"("booking_id" "uuid", "author_id" "uuid", "target_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_claim_booking_group_payment"("p_group_id" "uuid", "p_client_profile_id" "uuid", "p_attempt_token" "uuid") RETURNS TABLE("action" "text", "checkout_session_id" "text", "attempt_number" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_group public.booking_groups%rowtype;
  v_attempt integer;
begin
  select *
  into v_group
  from public.booking_groups
  where id = p_group_id
    and client_profile_id =
      p_client_profile_id
  for update;

  if not found then
    raise exception
      'KLYX_GROUP_PAYMENT_NOT_FOUND';
  end if;

  if v_group.payment_status = 'paid' then
    return query
    select
      'paid'::text,
      v_group.stripe_checkout_session_id,
      coalesce(
        v_group.payment_attempt_count,
        0
      );

    return;
  end if;

  if v_group.status <> 'accepted' then
    raise exception
      'KLYX_GROUP_PAYMENT_NOT_ACCEPTED';
  end if;

  if
    v_group.payment_status = 'processing'
    and v_group.stripe_checkout_session_id
      is not null
  then
    return query
    select
      'reuse'::text,
      v_group.stripe_checkout_session_id,
      coalesce(
        v_group.payment_attempt_count,
        0
      );

    return;
  end if;

  if
    v_group.payment_status = 'processing'
    and v_group.payment_checkout_started_at
      is not null
    and v_group.payment_checkout_started_at >
      now() - interval '2 minutes'
  then
    return query
    select
      'busy'::text,
      null::text,
      coalesce(
        v_group.payment_attempt_count,
        0
      );

    return;
  end if;

  v_attempt :=
    coalesce(
      v_group.payment_attempt_count,
      0
    ) + 1;

  update public.booking_groups
  set
    payment_status = 'processing',
    payment_attempt_token =
      p_attempt_token,
    payment_attempt_count =
      v_attempt,
    payment_checkout_started_at =
      now(),
    stripe_checkout_session_id =
      null,
    stripe_payment_intent_id =
      null,
    payment_failure_code =
      null,
    payment_failure_message =
      null,
    payment_failed_at =
      null,
    updated_at =
      now()
  where id =
    p_group_id;

  return query
  select
    'create'::text,
    null::text,
    v_attempt;
end;
$$;


ALTER FUNCTION "public"."klyx_claim_booking_group_payment"("p_group_id" "uuid", "p_client_profile_id" "uuid", "p_attempt_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_claim_booking_payment"("p_booking_id" "uuid", "p_client_profile_id" "uuid", "p_attempt_token" "uuid") RETURNS TABLE("action" "text", "checkout_session_id" "text", "attempt_number" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."klyx_claim_booking_payment"("p_booking_id" "uuid", "p_client_profile_id" "uuid", "p_attempt_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_claim_split_payment_unit_13_27"("p_unit_id" "uuid", "p_client_profile_id" "uuid", "p_attempt_token" "text") RETURNS TABLE("action" "text", "unit_id" "uuid", "checkout_session_id" "text", "attempt_number" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
    raise exception
      'KLYX_SPLIT_PAYMENT_UNIT_NOT_FOUND';
  end if;

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
    and
    v_unit.stripe_checkout_session_id is not null
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
    and
    v_unit.updated_at >
      now() - interval '2 minutes'
  then
    return query
    select
      'busy'::text,
      v_unit.id,
      v_unit.stripe_checkout_session_id,
      v_unit.attempt_number;

    return;
  end if;

  update
    public.split_booking_payment_units
  set
    status = 'creating',
    attempt_number =
      attempt_number + 1,
    attempt_token =
      p_attempt_token,
    last_error = null,
    updated_at = now()
  where
    id = v_unit.id
  returning *
  into v_unit;

  return query
  select
    'create'::text,
    v_unit.id,
    null::text,
    v_unit.attempt_number;
end;
$$;


ALTER FUNCTION "public"."klyx_claim_split_payment_unit_13_27"("p_unit_id" "uuid", "p_client_profile_id" "uuid", "p_attempt_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_confirm_split_booking_prices_13_23"("p_batch_id" "uuid", "p_client_profile_id" "uuid", "p_price_hash" "text", "p_price_snapshot" "jsonb", "p_item_count" integer, "p_total_amount_cents" bigint, "p_currency" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_owner uuid;
  v_status text;
  v_confirmation_id uuid;
begin
  select
    client_profile_id,
    status
  into
    v_owner,
    v_status
  from public.split_booking_batches
  where id = p_batch_id;

  if v_owner is null then
    raise exception
      'KLYX_SPLIT_PRICE_BATCH_NOT_FOUND';
  end if;

  if v_owner <> p_client_profile_id then
    raise exception
      'KLYX_SPLIT_PRICE_OWNER_REQUIRED';
  end if;

  if v_status <> 'created' then
    raise exception
      'KLYX_SPLIT_PRICE_BATCH_NOT_READY';
  end if;

  if
    p_price_hash is null
    or char_length(
      p_price_hash
    ) <> 64
  then
    raise exception
      'KLYX_SPLIT_PRICE_INVALID_HASH';
  end if;

  if p_item_count < 2 then
    raise exception
      'KLYX_SPLIT_PRICE_INVALID_COUNT';
  end if;

  if p_total_amount_cents < 0 then
    raise exception
      'KLYX_SPLIT_PRICE_INVALID_TOTAL';
  end if;

  if
    p_currency is null
    or char_length(
      p_currency
    ) <> 3
  then
    raise exception
      'KLYX_SPLIT_PRICE_INVALID_CURRENCY';
  end if;

  update
    public.split_booking_price_confirmations
  set
    invalidated_at = now(),
    invalidation_reason =
      'replaced_by_new_price_confirmation',
    updated_at = now()
  where
    batch_id = p_batch_id
    and invalidated_at is null;

  insert into
    public.split_booking_price_confirmations (
      batch_id,
      client_profile_id,
      price_hash,
      price_snapshot,
      item_count,
      total_amount_cents,
      currency
    )
  values (
    p_batch_id,
    p_client_profile_id,
    p_price_hash,
    p_price_snapshot,
    p_item_count,
    p_total_amount_cents,
    upper(
      p_currency
    )
  )
  returning id
  into v_confirmation_id;

  return v_confirmation_id;
end;
$$;


ALTER FUNCTION "public"."klyx_confirm_split_booking_prices_13_23"("p_batch_id" "uuid", "p_client_profile_id" "uuid", "p_price_hash" "text", "p_price_snapshot" "jsonb", "p_item_count" integer, "p_total_amount_cents" bigint, "p_currency" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_confirm_split_payment_plan_13_26"("p_batch_id" "uuid", "p_client_profile_id" "uuid", "p_price_confirmation_id" "uuid", "p_payment_plan_hash" "text", "p_payment_plan_snapshot" "jsonb", "p_provider_count" integer, "p_payment_unit_count" integer, "p_total_amount_cents" bigint, "p_currency" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_owner uuid;
  v_batch_status text;
  v_price_batch uuid;
  v_price_invalidated timestamptz;
  v_confirmation_id uuid;
begin
  select
    client_profile_id,
    status
  into
    v_owner,
    v_batch_status
  from public.split_booking_batches
  where id = p_batch_id;

  if v_owner is null then
    raise exception
      'KLYX_SPLIT_PAYMENT_BATCH_NOT_FOUND';
  end if;

  if v_owner <> p_client_profile_id then
    raise exception
      'KLYX_SPLIT_PAYMENT_OWNER_REQUIRED';
  end if;

  if v_batch_status <> 'created' then
    raise exception
      'KLYX_SPLIT_PAYMENT_BATCH_NOT_READY';
  end if;

  select
    batch_id,
    invalidated_at
  into
    v_price_batch,
    v_price_invalidated
  from public.split_booking_price_confirmations
  where id = p_price_confirmation_id;

  if v_price_batch is null then
    raise exception
      'KLYX_SPLIT_PAYMENT_PRICE_PROOF_NOT_FOUND';
  end if;

  if v_price_batch <> p_batch_id then
    raise exception
      'KLYX_SPLIT_PAYMENT_PRICE_PROOF_MISMATCH';
  end if;

  if v_price_invalidated is not null then
    raise exception
      'KLYX_SPLIT_PAYMENT_PRICE_PROOF_INVALIDATED';
  end if;

  if
    p_payment_plan_hash is null
    or char_length(
      p_payment_plan_hash
    ) <> 64
  then
    raise exception
      'KLYX_SPLIT_PAYMENT_INVALID_HASH';
  end if;

  if p_provider_count < 2 then
    raise exception
      'KLYX_SPLIT_PAYMENT_PROVIDER_COUNT_INVALID';
  end if;

  if p_payment_unit_count < 2 then
    raise exception
      'KLYX_SPLIT_PAYMENT_UNIT_COUNT_INVALID';
  end if;

  if p_total_amount_cents < 0 then
    raise exception
      'KLYX_SPLIT_PAYMENT_TOTAL_INVALID';
  end if;

  if
    p_currency is null
    or char_length(
      p_currency
    ) <> 3
  then
    raise exception
      'KLYX_SPLIT_PAYMENT_CURRENCY_INVALID';
  end if;

  update
    public.split_booking_payment_confirmations
  set
    invalidated_at = now(),
    invalidation_reason =
      'replaced_by_new_payment_confirmation',
    updated_at = now()
  where
    batch_id = p_batch_id
    and invalidated_at is null
    and consumed_at is null;

  insert into
    public.split_booking_payment_confirmations (
      batch_id,
      client_profile_id,
      price_confirmation_id,
      payment_plan_hash,
      payment_plan_snapshot,
      provider_count,
      payment_unit_count,
      total_amount_cents,
      currency
    )
  values (
    p_batch_id,
    p_client_profile_id,
    p_price_confirmation_id,
    p_payment_plan_hash,
    p_payment_plan_snapshot,
    p_provider_count,
    p_payment_unit_count,
    p_total_amount_cents,
    upper(
      p_currency
    )
  )
  returning id
  into v_confirmation_id;

  return v_confirmation_id;
end;
$$;


ALTER FUNCTION "public"."klyx_confirm_split_payment_plan_13_26"("p_batch_id" "uuid", "p_client_profile_id" "uuid", "p_price_confirmation_id" "uuid", "p_payment_plan_hash" "text", "p_payment_plan_snapshot" "jsonb", "p_provider_count" integer, "p_payment_unit_count" integer, "p_total_amount_cents" bigint, "p_currency" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_confirm_split_plan_13_18"("p_request_id" "uuid", "p_client_profile_id" "uuid", "p_plan_hash" "text", "p_plan_snapshot" "jsonb", "p_slot_count" integer, "p_provider_count" integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_owner uuid;
  v_confirmation_id uuid;
begin
  select client_profile_id
  into v_owner
  from public.market_service_requests
  where id = p_request_id;

  if v_owner is null then
    raise exception
      'KLYX_SPLIT_PLAN_REQUEST_NOT_FOUND';
  end if;

  if v_owner <> p_client_profile_id then
    raise exception
      'KLYX_SPLIT_PLAN_OWNER_REQUIRED';
  end if;

  if p_slot_count < 2 then
    raise exception
      'KLYX_SPLIT_PLAN_INVALID_SLOT_COUNT';
  end if;

  if p_provider_count < 2 then
    raise exception
      'KLYX_SPLIT_PLAN_INVALID_PROVIDER_COUNT';
  end if;

  if
    p_plan_hash is null
    or length(p_plan_hash) <> 64
  then
    raise exception
      'KLYX_SPLIT_PLAN_INVALID_HASH';
  end if;

  update public.market_split_plan_confirmations
  set
    invalidated_at = now(),
    invalidation_reason = 'replaced_by_new_confirmation',
    updated_at = now()
  where
    market_request_id = p_request_id
    and invalidated_at is null;

  insert into public.market_split_plan_confirmations (
    market_request_id,
    client_profile_id,
    plan_hash,
    plan_snapshot,
    slot_count,
    provider_count
  )
  values (
    p_request_id,
    p_client_profile_id,
    p_plan_hash,
    p_plan_snapshot,
    p_slot_count,
    p_provider_count
  )
  returning id
  into v_confirmation_id;

  return v_confirmation_id;
end;
$$;


ALTER FUNCTION "public"."klyx_confirm_split_plan_13_18"("p_request_id" "uuid", "p_client_profile_id" "uuid", "p_plan_hash" "text", "p_plan_snapshot" "jsonb", "p_slot_count" integer, "p_provider_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_consume_split_booking_proof_13_20"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_confirmation
    public.market_split_plan_confirmations%rowtype;

  v_existing_batch uuid;
begin
  if
    new.status <> 'created'
  then
    return new;
  end if;

  if
    old.status is not distinct from 'created'
  then
    return new;
  end if;

  select *
  into v_confirmation
  from public.market_split_plan_confirmations
  where id = new.confirmation_id;

  if not found then
    raise exception
      'KLYX_SPLIT_CONFIRMATION_NOT_FOUND';
  end if;

  if
    v_confirmation.invalidated_at
    is not null
  then
    raise exception
      'KLYX_SPLIT_CONFIRMATION_INVALIDATED';
  end if;

  if
    v_confirmation.market_request_id <>
      new.market_request_id
  then
    raise exception
      'KLYX_SPLIT_CONFIRMATION_REQUEST_MISMATCH';
  end if;

  if
    v_confirmation.client_profile_id <>
      new.client_profile_id
  then
    raise exception
      'KLYX_SPLIT_CONFIRMATION_CLIENT_MISMATCH';
  end if;

  if
    v_confirmation.plan_hash <>
      new.plan_hash
  then
    raise exception
      'KLYX_SPLIT_CONFIRMATION_HASH_MISMATCH';
  end if;

  insert into
    public.split_booking_proof_consumptions (
      confirmation_id,
      batch_id,
      market_request_id,
      client_profile_id,
      plan_hash
    )
  values (
    new.confirmation_id,
    new.id,
    new.market_request_id,
    new.client_profile_id,
    new.plan_hash
  )
  on conflict (
    confirmation_id
  )
  do nothing;

  select batch_id
  into v_existing_batch
  from public.split_booking_proof_consumptions
  where confirmation_id =
    new.confirmation_id;

  if
    v_existing_batch is distinct from
      new.id
  then
    raise exception
      'KLYX_SPLIT_CONFIRMATION_ALREADY_CONSUMED';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."klyx_consume_split_booking_proof_13_20"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_create_multi_slot_booking_group"("p_market_request_id" "uuid", "p_client_profile_id" "uuid", "p_offer_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_group_id uuid;

  v_request_status text;
  v_request_mode text;
  v_service_id uuid;

  v_provider_id uuid;
  v_user_service_id uuid;
  v_offer_status text;
  v_offer_amount numeric;

  v_total_cents integer;
  v_slot_count integer;
  v_null_budget_count integer;
  v_budget_total numeric;
  v_duration_total numeric;
  v_use_budget boolean;

  v_allocated integer := 0;
  v_current_amount integer;
  v_weight numeric;
  v_index integer := 0;

  v_slot record;
  v_booking_id uuid;
begin
  select
    id
  into
    v_group_id
  from public.booking_groups
  where market_request_id =
    p_market_request_id
    and status in (
      'pending_provider',
      'accepted'
    )
  order by created_at desc
  limit 1;

  if v_group_id is not null then
    return v_group_id;
  end if;

  select
    status,
    request_mode,
    service_id
  into
    v_request_status,
    v_request_mode,
    v_service_id
  from public.market_service_requests
  where id =
    p_market_request_id
    and client_profile_id =
      p_client_profile_id
  for update;

  if not found then
    raise exception
      'KLYX_GROUP_REQUEST_NOT_FOUND';
  end if;

  if v_request_mode <> 'multi_slot' then
    raise exception
      'KLYX_GROUP_REQUEST_REQUIRED';
  end if;

  if v_request_status <> 'open' then
    raise exception
      'KLYX_GROUP_REQUEST_NOT_OPEN';
  end if;

  select
    provider_profile_id,
    user_service_id,
    status,
    amount
  into
    v_provider_id,
    v_user_service_id,
    v_offer_status,
    v_offer_amount
  from public.market_service_offers
  where id =
    p_offer_id
    and request_id =
      p_market_request_id
  for update;

  if not found then
    raise exception
      'KLYX_GROUP_OFFER_NOT_FOUND';
  end if;

  if v_offer_status <> 'sent' then
    raise exception
      'KLYX_GROUP_OFFER_NOT_AVAILABLE';
  end if;

  if
    v_offer_amount is null
    or v_offer_amount <= 0
  then
    raise exception
      'KLYX_GROUP_OFFER_PRICE_INVALID';
  end if;

  select
    count(*),
    count(*) filter (
      where budget_max is null
    ),
    coalesce(
      sum(budget_max),
      0
    ),
    coalesce(
      sum(duration_minutes),
      0
    )
  into
    v_slot_count,
    v_null_budget_count,
    v_budget_total,
    v_duration_total
  from public.market_service_request_slots
  where market_request_id =
    p_market_request_id;

  if
    v_slot_count < 2
    or v_slot_count > 20
  then
    raise exception
      'KLYX_GROUP_SLOTS_INVALID';
  end if;

  if v_duration_total <= 0 then
    raise exception
      'KLYX_GROUP_DURATION_INVALID';
  end if;

  v_total_cents :=
    round(
      v_offer_amount * 100
    )::integer;

  if v_total_cents < v_slot_count then
    raise exception
      'KLYX_GROUP_PRICE_TOO_LOW';
  end if;

  v_use_budget :=
    v_null_budget_count = 0
    and v_budget_total > 0;

  insert into public.booking_groups (
    market_request_id,
    client_profile_id,
    provider_profile_id,
    user_service_id,
    offer_id,
    status,
    payment_status,
    total_amount_cents,
    currency,
    slot_count,
    updated_at
  )
  values (
    p_market_request_id,
    p_client_profile_id,
    v_provider_id,
    v_user_service_id,
    p_offer_id,
    'pending_provider',
    'unpaid',
    v_total_cents,
    'EUR',
    v_slot_count,
    now()
  )
  returning id
  into v_group_id;

  for v_slot in
    select
      position,
      requested_date,
      start_time,
      end_time,
      budget_max,
      duration_minutes
    from public.market_service_request_slots
    where market_request_id =
      p_market_request_id
    order by position
  loop
    v_index :=
      v_index + 1;

    if v_slot.end_time <= v_slot.start_time then
      raise exception
        'KLYX_GROUP_OVERNIGHT_NOT_SUPPORTED';
    end if;

    if v_use_budget then
      v_weight :=
        v_slot.budget_max;
    else
      v_weight :=
        v_slot.duration_minutes;
    end if;

    if v_index = v_slot_count then
      v_current_amount :=
        v_total_cents -
        v_allocated;
    else
      if v_use_budget then
        v_current_amount :=
          floor(
            v_total_cents *
            v_weight /
            v_budget_total
          )::integer;
      else
        v_current_amount :=
          floor(
            v_total_cents *
            v_weight /
            v_duration_total
          )::integer;
      end if;

      v_current_amount :=
        greatest(
          1,
          v_current_amount
        );
    end if;

    v_allocated :=
      v_allocated +
      v_current_amount;

    insert into public.bookings (
      parent_id,
      babysitter_id,
      provider_id,
      service_id,
      user_service_id,
      quote_id,
      booking_group_id,
      group_position,
      booking_date,
      start_time,
      end_time,
      message,
      status,
      payment_status,
      service_status,
      pricing_type_snapshot,
      unit_price_cents,
      estimated_amount_cents,
      amount_total,
      currency,
      updated_at
    )
    values (
      p_client_profile_id,
      v_provider_id,
      v_provider_id,
      v_service_id,
      v_user_service_id,
      null,
      v_group_id,
      v_slot.position,
      v_slot.requested_date,
      v_slot.start_time,
      v_slot.end_time,
      'Reservation groupee KLYX.',
      'pending',
      'unpaid',
      'scheduled',
      'fixed',
      v_current_amount,
      v_current_amount,
      v_current_amount,
      'EUR',
      now()
    )
    returning id
    into v_booking_id;

    insert into public.booking_status_events (
      booking_id,
      actor_id,
      previous_status,
      new_status,
      note
    )
    values (
      v_booking_id,
      p_client_profile_id,
      null,
      'pending',
      'Creneau cree depuis une reservation groupee KLYX.'
    );
  end loop;

  update public.market_service_offers
  set
    status = 'accepted',
    updated_at = now()
  where id = p_offer_id
    and request_id =
      p_market_request_id;

  update public.market_service_requests
  set
    status = 'matched',
    accepted_offer_id =
      p_offer_id,
    updated_at = now()
  where id =
    p_market_request_id
    and client_profile_id =
      p_client_profile_id;

  return v_group_id;
end;
$$;


ALTER FUNCTION "public"."klyx_create_multi_slot_booking_group"("p_market_request_id" "uuid", "p_client_profile_id" "uuid", "p_offer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_create_profile"("p_first_name" "text", "p_last_name" "text", "p_city" "text", "p_account_type" "text", "p_service_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  owner_id uuid := auth.uid();
  profile_id uuid := gen_random_uuid();
  normalized_first_name text := nullif(trim(p_first_name), '');
  normalized_last_name text := nullif(trim(p_last_name), '');
  normalized_city text := nullif(trim(p_city), '');
  service_name text;
  service_slug text;
  user_service_id uuid;
begin
  if owner_id is null then
    raise exception 'KLYX_NOT_AUTHENTICATED';
  end if;

  if normalized_first_name is null or length(normalized_first_name) > 60 then
    raise exception 'KLYX_INVALID_FIRST_NAME';
  end if;

  if normalized_last_name is null or length(normalized_last_name) > 60 then
    raise exception 'KLYX_INVALID_LAST_NAME';
  end if;

  if normalized_city is null or length(normalized_city) > 100 then
    raise exception 'KLYX_INVALID_CITY';
  end if;

  if p_account_type not in ('client', 'provider') then
    raise exception 'KLYX_INVALID_ACCOUNT_TYPE';
  end if;

  if (
    select count(*)
    from public.profiles profile
    where profile.owner_user_id = owner_id
  ) >= 5 then
    raise exception 'KLYX_PROFILE_LIMIT_REACHED';
  end if;

  if p_account_type = 'provider' then
    if p_service_id is null then
      raise exception 'KLYX_SERVICE_REQUIRED';
    end if;

    select service.name, service.slug
    into service_name, service_slug
    from public.services service
    where service.id = p_service_id;

    if service_name is null then
      raise exception 'KLYX_SERVICE_NOT_FOUND';
    end if;
  end if;

  insert into public.profiles (
    id,
    owner_user_id,
    first_name,
    last_name,
    full_name,
    city,
    account_type,
    current_mode,
    role
  )
  values (
    profile_id,
    owner_id,
    normalized_first_name,
    normalized_last_name,
    normalized_first_name || ' ' || normalized_last_name,
    normalized_city,
    p_account_type,
    p_account_type,
    case when p_account_type = 'provider' then 'babysitter' else 'client' end
  );

  if p_account_type = 'provider' then
    insert into public.user_services (
      user_id,
      service_id,
      active
    )
    values (
      profile_id,
      p_service_id,
      true
    )
    returning id into user_service_id;

    insert into public.service_profiles (
      user_service_id,
      title,
      city,
      available,
      rating,
      review_count,
      permit,
      smoker
    )
    values (
      user_service_id,
      case
        when service_slug = 'babysitting' then 'Baby-sitter'
        else service_name
      end,
      normalized_city,
      true,
      0,
      0,
      false,
      false
    );
  end if;

  return profile_id;
end;
$$;


ALTER FUNCTION "public"."klyx_create_profile"("p_first_name" "text", "p_last_name" "text", "p_city" "text", "p_account_type" "text", "p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_delete_profile"("p_profile_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null then
    raise exception 'KLYX_NOT_AUTHENTICATED';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_profile_id
      and profile.owner_user_id = owner_id
  ) then
    raise exception 'KLYX_PROFILE_NOT_OWNED';
  end if;

  if (
    select count(*)
    from public.profiles profile
    where profile.owner_user_id = owner_id
  ) <= 1 then
    raise exception 'KLYX_LAST_PROFILE';
  end if;

  delete from public.availability_slots slot
  where slot.user_service_id in (
    select user_service.id
    from public.user_services user_service
    where user_service.user_id = p_profile_id
  );

  delete from public.service_profiles service_profile
  where service_profile.user_service_id in (
    select user_service.id
    from public.user_services user_service
    where user_service.user_id = p_profile_id
  );

  delete from public.user_services user_service
  where user_service.user_id = p_profile_id;

  delete from public.profiles profile
  where profile.id = p_profile_id
    and profile.owner_user_id = owner_id;
end;
$$;


ALTER FUNCTION "public"."klyx_delete_profile"("p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_enforce_group_live_coverage_12_96"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_result jsonb;
  v_code text;
begin
  v_result :=
    public.klyx_group_live_coverage_check(
      new.market_request_id,
      new.provider_profile_id,
      new.user_service_id
    );

  if
    coalesce(
      (v_result ->> 'ok')::boolean,
      false
    ) = false
  then
    v_code :=
      coalesce(
        v_result ->> 'code',
        'GROUP_LIVE_COVERAGE_REQUIRED'
      );

    raise exception
      'KLYX_GROUP_LIVE_COVERAGE_REQUIRED:%',
      v_code
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."klyx_enforce_group_live_coverage_12_96"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_enforce_group_provider_accept_live_13_06"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_new jsonb;
  v_old jsonb;
  v_child jsonb;
  v_offer jsonb;

  v_new_status text;
  v_old_status text;

  v_request_id uuid;
  v_provider_profile_id uuid;
  v_user_service_id uuid;
  v_offer_id uuid;

  v_live jsonb;

  v_ok boolean;
  v_full_coverage boolean;

  v_coverage_count integer;
  v_slot_count integer;

  v_code text;
begin
  v_new :=
    to_jsonb(new);

  v_old :=
    to_jsonb(old);

  v_new_status :=
    lower(
      coalesce(
        v_new ->> 'status',
        ''
      )
    );

  v_old_status :=
    lower(
      coalesce(
        v_old ->> 'status',
        ''
      )
    );

  /*
    KLYX 13.06

    Ne concerne que le passage explicite
    du groupe vers un etat accepte.
  */
  if
    v_new_status not in (
      'accepted',
      'provider_accepted'
    )
  then
    return new;
  end if;

  /*
    Pas de revalidation inutile si le groupe
    etait deja accepte.
  */
  if
    v_old_status in (
      'accepted',
      'provider_accepted'
    )
  then
    return new;
  end if;

  /*
    ==========================================================
    CONTEXTE DIRECT DU BOOKING GROUP
    ==========================================================

    to_jsonb permet de rester compatible
    avec les variantes historiques de colonnes.
  */

  begin
    v_request_id :=
      nullif(
        coalesce(
          v_new ->> 'market_request_id',
          v_new ->> 'request_id'
        ),
        ''
      )::uuid;
  exception
    when others then
      v_request_id := null;
  end;

  begin
    v_provider_profile_id :=
      nullif(
        coalesce(
          v_new ->> 'provider_profile_id',
          v_new ->> 'provider_id'
        ),
        ''
      )::uuid;
  exception
    when others then
      v_provider_profile_id := null;
  end;

  begin
    v_user_service_id :=
      nullif(
        coalesce(
          v_new ->> 'user_service_id',
          v_new ->> 'service_id'
        ),
        ''
      )::uuid;
  exception
    when others then
      v_user_service_id := null;
  end;

  begin
    v_offer_id :=
      nullif(
        coalesce(
          v_new ->> 'market_offer_id',
          v_new ->> 'offer_id',
          v_new ->> 'selected_offer_id'
        ),
        ''
      )::uuid;
  exception
    when others then
      v_offer_id := null;
  end;

  /*
    ==========================================================
    FALLBACK : BOOKING ENFANT
    ==========================================================
  */

  select
    to_jsonb(b)
  into
    v_child
  from
    public.bookings b
  where
    b.booking_group_id =
      new.id
  order by
    b.group_position nulls last,
    b.id
  limit 1;

  if
    v_child is not null
  then
    if
      v_request_id is null
    then
      begin
        v_request_id :=
          nullif(
            coalesce(
              v_child ->> 'market_request_id',
              v_child ->> 'request_id'
            ),
            ''
          )::uuid;
      exception
        when others then
          v_request_id := null;
      end;
    end if;

    if
      v_provider_profile_id is null
    then
      begin
        v_provider_profile_id :=
          nullif(
            coalesce(
              v_child ->> 'provider_id',
              v_child ->> 'babysitter_id',
              v_child ->> 'provider_profile_id'
            ),
            ''
          )::uuid;
      exception
        when others then
          v_provider_profile_id := null;
      end;
    end if;

    if
      v_user_service_id is null
    then
      begin
        v_user_service_id :=
          nullif(
            coalesce(
              v_child ->> 'user_service_id',
              v_child ->> 'service_id'
            ),
            ''
          )::uuid;
      exception
        when others then
          v_user_service_id := null;
      end;
    end if;

    if
      v_offer_id is null
    then
      begin
        v_offer_id :=
          nullif(
            coalesce(
              v_child ->> 'market_offer_id',
              v_child ->> 'offer_id',
              v_child ->> 'selected_offer_id'
            ),
            ''
          )::uuid;
      exception
        when others then
          v_offer_id := null;
      end;
    end if;
  end if;

  /*
    ==========================================================
    FALLBACK : OFFRE KLYX
    ==========================================================
  */

  if
    v_offer_id is not null
  then
    select
      to_jsonb(o)
    into
      v_offer
    from
      public.market_service_offers o
    where
      o.id =
        v_offer_id
    limit 1;

  elsif
    v_request_id is not null
    and
    v_provider_profile_id is not null
  then
    select
      to_jsonb(o)
    into
      v_offer
    from
      public.market_service_offers o
    where
      o.request_id =
        v_request_id
      and
      o.provider_profile_id =
        v_provider_profile_id
    order by
      o.created_at desc
    limit 1;
  end if;

  if
    v_offer is not null
  then
    if
      v_request_id is null
    then
      begin
        v_request_id :=
          nullif(
            v_offer ->> 'request_id',
            ''
          )::uuid;
      exception
        when others then
          v_request_id := null;
      end;
    end if;

    if
      v_provider_profile_id is null
    then
      begin
        v_provider_profile_id :=
          nullif(
            v_offer ->> 'provider_profile_id',
            ''
          )::uuid;
      exception
        when others then
          v_provider_profile_id := null;
      end;
    end if;

    if
      v_user_service_id is null
    then
      begin
        v_user_service_id :=
          nullif(
            v_offer ->> 'user_service_id',
            ''
          )::uuid;
      exception
        when others then
          v_user_service_id := null;
      end;
    end if;
  end if;

  /*
    KLYX doit pouvoir PROUVER le contexte exact.

    Sinon aucune acceptation silencieuse.
  */
  if
    v_request_id is null
    or
    v_provider_profile_id is null
    or
    v_user_service_id is null
  then
    raise exception
      'KLYX_GROUP_ACCEPT_LIVE_CONTEXT_REQUIRED'
      using
        errcode =
          'P0001';
  end if;

  /*
    ==========================================================
    REVALIDATION ATOMIQUE 12.96
    ==========================================================

    Verifie notamment :
    - service actif
    - nombre de slots
    - disponibilites
    - conflits booking
    - couverture N/N
  */

  select
    public.klyx_group_live_coverage_check(
      v_request_id,
      v_provider_profile_id,
      v_user_service_id
    )
  into
    v_live;

  if
    v_live is null
  then
    raise exception
      'KLYX_GROUP_ACCEPT_LIVE_COVERAGE_REQUIRED:NO_RESULT'
      using
        errcode =
          'P0001';
  end if;

  /*
    Support camelCase + snake_case.
  */

  begin
    v_ok :=
      coalesce(
        nullif(
          v_live ->> 'ok',
          ''
        )::boolean,
        false
      );
  exception
    when others then
      v_ok := false;
  end;

  begin
    v_full_coverage :=
      coalesce(
        nullif(
          v_live ->> 'fullCoverage',
          ''
        )::boolean,
        nullif(
          v_live ->> 'full_coverage',
          ''
        )::boolean,
        false
      );
  exception
    when others then
      v_full_coverage := false;
  end;

  begin
    v_coverage_count :=
      coalesce(
        nullif(
          v_live ->> 'coverageCount',
          ''
        )::integer,
        nullif(
          v_live ->> 'coverage_count',
          ''
        )::integer,
        0
      );
  exception
    when others then
      v_coverage_count := 0;
  end;

  begin
    v_slot_count :=
      coalesce(
        nullif(
          v_live ->> 'slotCount',
          ''
        )::integer,
        nullif(
          v_live ->> 'slot_count',
          ''
        )::integer,
        0
      );
  exception
    when others then
      v_slot_count := 0;
  end;

  v_code :=
    coalesce(
      nullif(
        v_live ->> 'code',
        ''
      ),
      'UNKNOWN'
    );

  /*
    Exactement N/N requis.
  */

  if
    v_ok is distinct from true
    or
    v_full_coverage is distinct from true
    or
    v_slot_count < 2
    or
    v_coverage_count <>
      v_slot_count
  then
    raise exception
      'KLYX_GROUP_ACCEPT_LIVE_COVERAGE_REQUIRED:%',
      v_code
      using
        errcode =
          'P0001';
  end if;

  /*
    Le trigger n'accepte RIEN lui-meme.

    Il autorise seulement la transition
    explicitement demandee.
  */

  return new;
end;
$$;


ALTER FUNCTION "public"."klyx_enforce_group_provider_accept_live_13_06"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."klyx_enforce_group_provider_accept_live_13_06"() IS 'KLYX 13.06 - revalidation live N/N avant acceptation explicite d une mission groupee.';



CREATE OR REPLACE FUNCTION "public"."klyx_enforce_multi_slot_offer_live_13_09"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_offer jsonb;
  v_request jsonb;

  v_request_id uuid;
  v_provider_profile_id uuid;
  v_user_service_id uuid;

  v_offer_status text;
  v_request_mode text;
  v_request_status text;

  v_expected_slots integer;

  v_live jsonb;

  v_ok boolean;
  v_full boolean;

  v_coverage_count integer;
  v_slot_count integer;

  v_code text;
begin
  v_offer :=
    to_jsonb(new);

  /*
    ----------------------------------------------------------
    CONTEXTE OFFRE
    ----------------------------------------------------------
  */

  begin
    v_request_id :=
      nullif(
        coalesce(
          v_offer ->> 'request_id',
          v_offer ->> 'market_request_id'
        ),
        ''
      )::uuid;
  exception
    when others then
      v_request_id := null;
  end;

  begin
    v_provider_profile_id :=
      nullif(
        coalesce(
          v_offer ->> 'provider_profile_id',
          v_offer ->> 'provider_id'
        ),
        ''
      )::uuid;
  exception
    when others then
      v_provider_profile_id := null;
  end;

  begin
    v_user_service_id :=
      nullif(
        coalesce(
          v_offer ->> 'user_service_id',
          v_offer ->> 'service_id'
        ),
        ''
      )::uuid;
  exception
    when others then
      v_user_service_id := null;
  end;

  v_offer_status :=
    lower(
      coalesce(
        v_offer ->> 'status',
        ''
      )
    );

  /*
    Les transitions terminales ne constituent
    pas un nouvel envoi commercial.
  */
  if
    v_offer_status in (
      'accepted',
      'rejected',
      'cancelled',
      'canceled',
      'withdrawn',
      'expired'
    )
  then
    return new;
  end if;

  /*
    Laisse les contraintes historiques traiter
    un request_id inexistant ou mal forme.
  */
  if
    v_request_id is null
  then
    return new;
  end if;

  /*
    ----------------------------------------------------------
    MARKET REQUEST
    ----------------------------------------------------------

    select to_jsonb evite de figer inutilement
    les noms historiques du schema.
  */

  select
    to_jsonb(r)
  into
    v_request
  from
    public.market_service_requests r
  where
    r.id =
      v_request_id
  limit 1;

  if
    v_request is null
  then
    return new;
  end if;

  v_request_mode :=
    lower(
      coalesce(
        v_request ->> 'request_mode',
        'single'
      )
    );

  /*
    Mission simple :
    comportement historique inchange.
  */
  if
    v_request_mode <>
      'multi_slot'
  then
    return new;
  end if;

  v_request_status :=
    lower(
      coalesce(
        v_request ->> 'status',
        ''
      )
    );

  begin
    v_expected_slots :=
      coalesce(
        nullif(
          v_request ->> 'slot_count',
          ''
        )::integer,
        0
      );
  exception
    when others then
      v_expected_slots := 0;
  end;

  /*
    Une vraie demande multi-slot doit avoir
    au moins deux creneaux.
  */
  if
    v_expected_slots <
      2
  then
    raise exception
      'KLYX_MULTI_SLOT_OFFER_ATOMIC_INVALID_SLOT_COUNT'
      using
        errcode =
          'P0001';
  end if;

  /*
    Aucune nouvelle offre sur une demande
    deja fermee ou finalisee.
  */
  if
    v_request_status <>
      'open'
  then
    raise exception
      'KLYX_MULTI_SLOT_OFFER_ATOMIC_REQUEST_NOT_OPEN'
      using
        errcode =
          'P0001';
  end if;

  /*
    Pour une offre multi-slot, le contexte
    prestataire/service exact est obligatoire.
  */
  if
    v_provider_profile_id is null
    or
    v_user_service_id is null
  then
    raise exception
      'KLYX_MULTI_SLOT_OFFER_ATOMIC_CONTEXT_REQUIRED'
      using
        errcode =
          'P0001';
  end if;

  /*
    ----------------------------------------------------------
    REVALIDATION LIVE
    ----------------------------------------------------------

    Source de verite :
    RPC atomique introduite en 12.96.
  */

  select
    public.klyx_group_live_coverage_check(
      v_request_id,
      v_provider_profile_id,
      v_user_service_id
    )
  into
    v_live;

  if
    v_live is null
  then
    raise exception
      'KLYX_MULTI_SLOT_OFFER_ATOMIC_COVERAGE_REQUIRED:NO_RESULT'
      using
        errcode =
          'P0001';
  end if;

  /*
    Compatible camelCase + snake_case.
  */

  begin
    v_ok :=
      coalesce(
        nullif(
          v_live ->> 'ok',
          ''
        )::boolean,
        false
      );
  exception
    when others then
      v_ok := false;
  end;

  begin
    v_full :=
      coalesce(
        nullif(
          v_live ->> 'fullCoverage',
          ''
        )::boolean,
        nullif(
          v_live ->> 'full_coverage',
          ''
        )::boolean,
        false
      );
  exception
    when others then
      v_full := false;
  end;

  begin
    v_coverage_count :=
      coalesce(
        nullif(
          v_live ->> 'coverageCount',
          ''
        )::integer,
        nullif(
          v_live ->> 'coverage_count',
          ''
        )::integer,
        0
      );
  exception
    when others then
      v_coverage_count := 0;
  end;

  begin
    v_slot_count :=
      coalesce(
        nullif(
          v_live ->> 'slotCount',
          ''
        )::integer,
        nullif(
          v_live ->> 'slot_count',
          ''
        )::integer,
        0
      );
  exception
    when others then
      v_slot_count := 0;
  end;

  v_code :=
    coalesce(
      nullif(
        v_live ->> 'code',
        ''
      ),
      'UNKNOWN'
    );

  /*
    ----------------------------------------------------------
    N/N STRICT
    ----------------------------------------------------------

    Entre le controle API 12.95 et cet INSERT,
    un conflit peut apparaitre.

    Le trigger ferme cette fenetre.
  */

  if
    v_ok is distinct from true
    or
    v_full is distinct from true
    or
    v_slot_count <>
      v_expected_slots
    or
    v_coverage_count <>
      v_expected_slots
  then
    raise exception
      'KLYX_MULTI_SLOT_OFFER_ATOMIC_COVERAGE_REQUIRED:%',
      v_code
      using
        errcode =
          'P0001';
  end if;

  /*
    IMPORTANT :

    le trigger ne cree aucune offre.
    Il autorise seulement l'INSERT/UPDATE
    deja explicitement demande par le
    prestataire.
  */

  return new;
end;
$$;


ALTER FUNCTION "public"."klyx_enforce_multi_slot_offer_live_13_09"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."klyx_enforce_multi_slot_offer_live_13_09"() IS 'KLYX 13.09 - garde atomique N/N avant envoi ou modification active d une offre multi-creneaux.';



CREATE OR REPLACE FUNCTION "public"."klyx_finalize_split_payment_run_13_27"("p_run_id" "uuid", "p_client_profile_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_run public.split_booking_payment_runs%rowtype;
  v_ready_count integer;
  v_paid_count integer;
begin
  select *
  into v_run
  from public.split_booking_payment_runs
  where
    id = p_run_id
    and client_profile_id =
      p_client_profile_id
  for update;

  if not found then
    raise exception
      'KLYX_SPLIT_PAYMENT_RUN_NOT_FOUND';
  end if;

  select
    count(*) filter (
      where status in (
        'checkout_open',
        'paid'
      )
    ),
    count(*) filter (
      where status = 'paid'
    )
  into
    v_ready_count,
    v_paid_count
  from public.split_booking_payment_units
  where run_id = v_run.id;

  if
    v_ready_count <>
      v_run.payment_unit_count
  then
    return false;
  end if;

  update
    public.split_booking_payment_confirmations
  set
    consumed_at =
      coalesce(
        consumed_at,
        now()
      ),
    updated_at = now()
  where
    id =
      v_run.payment_confirmation_id
    and invalidated_at is null;

  update
    public.split_booking_payment_runs
  set
    status =
      case
        when
          v_paid_count =
            payment_unit_count
        then 'paid'
        when
          v_paid_count > 0
        then 'partially_paid'
        else 'ready'
      end,
    ready_at =
      coalesce(
        ready_at,
        now()
      ),
    paid_at =
      case
        when
          v_paid_count =
            payment_unit_count
        then
          coalesce(
            paid_at,
            now()
          )
        else paid_at
      end,
    updated_at = now()
  where id = v_run.id;

  return true;
end;
$$;


ALTER FUNCTION "public"."klyx_finalize_split_payment_run_13_27"("p_run_id" "uuid", "p_client_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_group_live_coverage_check"("p_request_id" "uuid", "p_provider_profile_id" "uuid", "p_user_service_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_request record;
  v_service record;
  v_slot record;

  v_actual_slot_count integer := 0;
  v_covered_count integer := 0;

  v_available boolean := false;

  v_conflict_booking_id uuid := null;
begin
  -- =========================================================
  -- 1. Demande multi-slot
  -- =========================================================

  select
    r.id,
    r.service_id,
    r.request_mode,
    r.slot_count,
    r.status
  into v_request
  from public.market_service_requests r
  where r.id = p_request_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_LIVE_REQUEST_NOT_FOUND',
      'coverageCount', 0,
      'slotCount', 0
    );
  end if;

  if
    v_request.request_mode <> 'multi_slot'
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_LIVE_NOT_MULTI_SLOT',
      'coverageCount', 0,
      'slotCount', coalesce(v_request.slot_count, 0)
    );
  end if;

  if
    coalesce(v_request.slot_count, 0) < 2
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_LIVE_INVALID_SLOT_COUNT',
      'coverageCount', 0,
      'slotCount', coalesce(v_request.slot_count, 0)
    );
  end if;

  -- =========================================================
  -- 2. Le service prestataire doit encore etre actif
  -- =========================================================

  select
    us.id,
    us.user_id,
    us.service_id,
    us.active,
    us.provider_enabled
  into v_service
  from public.user_services us
  where us.id = p_user_service_id
    and us.user_id = p_provider_profile_id
    and us.service_id = v_request.service_id
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_LIVE_SERVICE_NOT_FOUND',
      'coverageCount', 0,
      'slotCount', v_request.slot_count
    );
  end if;

  if
    coalesce(v_service.active, false) = false
    or
    coalesce(v_service.provider_enabled, false) = false
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_LIVE_SERVICE_INACTIVE',
      'coverageCount', 0,
      'slotCount', v_request.slot_count
    );
  end if;

  -- =========================================================
  -- 3. Le snapshot des slots doit toujours etre canonique
  -- =========================================================

  select count(*)
  into v_actual_slot_count
  from public.market_service_request_slots s
  where s.market_request_id = p_request_id;

  if
    v_actual_slot_count <> v_request.slot_count
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_LIVE_SLOT_COUNT_CHANGED',
      'coverageCount', 0,
      'slotCount', v_actual_slot_count,
      'expectedSlotCount', v_request.slot_count
    );
  end if;

  -- =========================================================
  -- 4. Verification slot par slot
  --
  -- 12.85 interdit deja les groupes overnight :
  -- end_time doit donc rester strictement > start_time ici.
  -- =========================================================

  for v_slot in
    select
      s.id,
      s.position,
      s.requested_date,
      s.start_time,
      s.end_time
    from public.market_service_request_slots s
    where s.market_request_id = p_request_id
    order by s.position asc
  loop
    if
      v_slot.requested_date is null
      or
      v_slot.start_time is null
      or
      v_slot.end_time is null
      or
      v_slot.end_time <= v_slot.start_time
    then
      return jsonb_build_object(
        'ok', false,
        'code', 'GROUP_LIVE_SLOT_TIME_INVALID',
        'coverageCount', v_covered_count,
        'slotCount', v_request.slot_count,
        'failedPosition', v_slot.position
      );
    end if;

    -- =======================================================
    -- Disponibilite recurrante LIVE
    --
    -- Postgres extract(dow):
    -- dimanche = 0 ... samedi = 6
    -- Meme convention que le planning KLYX.
    -- =======================================================

    select exists (
      select 1
      from public.availability_slots a
      where a.user_service_id = p_user_service_id
        and a.is_active = true
        and a.day_of_week =
          extract(
            dow
            from v_slot.requested_date
          )::integer
        and a.start_time <= v_slot.start_time
        and a.end_time >= v_slot.end_time
    )
    into v_available;

    if
      coalesce(v_available, false) = false
    then
      return jsonb_build_object(
        'ok', false,
        'code', 'GROUP_LIVE_OUTSIDE_AVAILABILITY',
        'coverageCount', v_covered_count,
        'slotCount', v_request.slot_count,
        'failedPosition', v_slot.position,
        'date', v_slot.requested_date
      );
    end if;

    -- =======================================================
    -- Conflits reels LIVE
    --
    -- pending n est volontairement pas un hard conflict :
    -- le prestataire doit encore accepter une mission pending.
    -- accepted/completed restent les hard conflicts KLYX.
    -- =======================================================

    select b.id
    into v_conflict_booking_id
    from public.bookings b
    where (
      b.provider_id = p_provider_profile_id
      or
      b.babysitter_id = p_provider_profile_id
    )
      and b.booking_date = v_slot.requested_date
      and b.status in (
        'accepted',
        'completed'
      )
      and b.start_time < v_slot.end_time
      and b.end_time > v_slot.start_time
    order by b.booking_date asc, b.start_time asc
    limit 1;

    if
      v_conflict_booking_id is not null
    then
      return jsonb_build_object(
        'ok', false,
        'code', 'GROUP_LIVE_BOOKING_CONFLICT',
        'coverageCount', v_covered_count,
        'slotCount', v_request.slot_count,
        'failedPosition', v_slot.position,
        'conflictBookingId', v_conflict_booking_id
      );
    end if;

    v_covered_count :=
      v_covered_count + 1;

    v_conflict_booking_id :=
      null;
  end loop;

  -- =========================================================
  -- 5. Couverture finale N/N
  -- =========================================================

  if
    v_covered_count <> v_request.slot_count
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_LIVE_INCOMPLETE',
      'coverageCount', v_covered_count,
      'slotCount', v_request.slot_count
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'coverageCount', v_covered_count,
    'slotCount', v_request.slot_count,
    'fullCoverage', true,
    'checkedAt', now()
  );
end;
$$;


ALTER FUNCTION "public"."klyx_group_live_coverage_check"("p_request_id" "uuid", "p_provider_profile_id" "uuid", "p_user_service_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."klyx_group_live_coverage_check"("p_request_id" "uuid", "p_provider_profile_id" "uuid", "p_user_service_id" "uuid") IS 'KLYX 12.96 - revalidation atomique des disponibilites et conflits avant creation booking group.';



CREATE OR REPLACE FUNCTION "public"."klyx_owns_avatar_path"("object_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  folder_id text;
begin
  folder_id := split_part(object_name, '/', 1);

  if folder_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  return public.klyx_owns_profile(folder_id::uuid);
end;
$_$;


ALTER FUNCTION "public"."klyx_owns_avatar_path"("object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_owns_booking"("booking_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.bookings booking
    where booking.id = booking_id
      and (
        public.klyx_owns_profile(booking.parent_id)
        or public.klyx_owns_profile(
          coalesce(booking.provider_id, booking.babysitter_id)
        )
      )
  );
$$;


ALTER FUNCTION "public"."klyx_owns_booking"("booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_owns_conversation"("conversation_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.brain_conversations conversation
    where conversation.id = conversation_id
      and public.klyx_owns_profile(conversation.user_id)
  );
$$;


ALTER FUNCTION "public"."klyx_owns_conversation"("conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_owns_profile"("profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = profile_id
      and profile.owner_user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."klyx_owns_profile"("profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_owns_project"("project_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.projects project
    where project.id = project_id
      and public.klyx_owns_profile(project.user_id)
  );
$$;


ALTER FUNCTION "public"."klyx_owns_project"("project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_owns_user_service"("user_service_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.user_services user_service
    where user_service.id = user_service_id
      and public.klyx_owns_profile(user_service.user_id)
  );
$$;


ALTER FUNCTION "public"."klyx_owns_user_service"("user_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_prepare_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  new.owner_user_id := coalesce(new.owner_user_id, new.id);
  new.account_type := case
    when new.account_type = 'provider' then 'provider'
    when new.role in ('provider', 'babysitter') then 'provider'
    else 'client'
  end;
  return new;
end;
$$;


ALTER FUNCTION "public"."klyx_prepare_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_prevent_provider_booking_overlap"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."klyx_prevent_provider_booking_overlap"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_profile_has_type"("profile_id" "uuid", "expected_type" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = profile_id
      and profile.account_type = expected_type
  );
$$;


ALTER FUNCTION "public"."klyx_profile_has_type"("profile_id" "uuid", "expected_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_protect_paid_booking"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."klyx_protect_paid_booking"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_provider_group_decision"("p_group_id" "uuid", "p_provider_profile_id" "uuid", "p_action" "text", "p_note" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_group record;
begin
  if p_action not in (
    'accept',
    'reject'
  ) then
    raise exception
      'KLYX_GROUP_ACTION_INVALID';
  end if;

  select
    *
  into
    v_group
  from public.booking_groups
  where id =
    p_group_id
    and provider_profile_id =
      p_provider_profile_id
  for update;

  if not found then
    raise exception
      'KLYX_GROUP_NOT_FOUND';
  end if;

  if v_group.status = 'accepted' then
    return 'accepted';
  end if;

  if v_group.status = 'rejected' then
    return 'rejected';
  end if;

  if v_group.status <>
    'pending_provider'
  then
    raise exception
      'KLYX_GROUP_NOT_PENDING';
  end if;

  if p_action = 'accept' then
    update public.bookings
    set
      status = 'accepted',
      accepted_at = now(),
      provider_response =
        nullif(
          trim(
            coalesce(
              p_note,
              ''
            )
          ),
          ''
        ),
      service_status =
        'scheduled',
      updated_at = now()
    where booking_group_id =
      p_group_id
      and status =
        'pending';

    insert into public.booking_status_events (
      booking_id,
      actor_id,
      previous_status,
      new_status,
      note
    )
    select
      id,
      p_provider_profile_id,
      'pending',
      'accepted',
      coalesce(
        nullif(
          trim(
            coalesce(
              p_note,
              ''
            )
          ),
          ''
        ),
        'Reservation groupee acceptee par le prestataire.'
      )
    from public.bookings
    where booking_group_id =
      p_group_id
      and status =
        'accepted';

    update public.booking_groups
    set
      status =
        'accepted',
      accepted_at =
        now(),
      updated_at =
        now()
    where id =
      p_group_id;

    update public.market_service_offers
    set
      status =
        'rejected',
      updated_at =
        now()
    where request_id =
      v_group.market_request_id
      and id <>
        v_group.offer_id
      and status =
        'sent';

    return 'accepted';
  end if;

  update public.bookings
  set
    status =
      'rejected',
    rejected_at =
      now(),
    provider_response =
      nullif(
        trim(
          coalesce(
            p_note,
            ''
          )
        ),
        ''
      ),
    service_status =
      'cancelled',
    updated_at =
      now()
  where booking_group_id =
    p_group_id
    and status =
      'pending';

  insert into public.booking_status_events (
    booking_id,
    actor_id,
    previous_status,
    new_status,
    note
  )
  select
    id,
    p_provider_profile_id,
    'pending',
    'rejected',
    coalesce(
      nullif(
        trim(
          coalesce(
            p_note,
            ''
          )
        ),
        ''
      ),
      'Reservation groupee refusee par le prestataire.'
    )
  from public.bookings
  where booking_group_id =
    p_group_id
    and status =
      'rejected';

  update public.booking_groups
  set
    status =
      'rejected',
    rejected_at =
      now(),
    updated_at =
      now()
  where id =
    p_group_id;

  update public.market_service_offers
  set
    status =
      'rejected',
    updated_at =
      now()
  where id =
    v_group.offer_id;

  update public.market_service_requests
  set
    status =
      'open',
    accepted_offer_id =
      null,
    updated_at =
      now()
  where id =
    v_group.market_request_id;

  return 'rejected';
end;
$$;


ALTER FUNCTION "public"."klyx_provider_group_decision"("p_group_id" "uuid", "p_provider_profile_id" "uuid", "p_action" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_recompute_split_refund_run_13_28"("p_run_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_total integer;
  v_paid integer;
  v_refunded integer;
  v_refund_activity integer;
  v_status text;
begin
  select
    count(*),
    count(*) filter (
      where status = 'paid'
    ),
    count(*) filter (
      where refund_status = 'refunded'
    ),
    count(*) filter (
      where refund_status <> 'none'
    )
  into
    v_total,
    v_paid,
    v_refunded,
    v_refund_activity
  from public.split_booking_payment_units
  where run_id = p_run_id;

  if
    v_total > 0
    and
    v_refunded = v_total
  then
    v_status =
      'refunded';

  elsif
    v_refund_activity > 0
  then
    v_status =
      'partially_refunded';

  elsif
    v_total > 0
    and
    v_paid = v_total
  then
    v_status =
      'paid';

  elsif
    v_paid > 0
  then
    v_status =
      'partially_paid';

  else
    v_status =
      'ready';
  end if;

  update
    public.split_booking_payment_runs
  set
    status =
      v_status,
    updated_at =
      now()
  where id =
    p_run_id;

  return v_status;
end;
$$;


ALTER FUNCTION "public"."klyx_recompute_split_refund_run_13_28"("p_run_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_release_expired_booking_checkout"("p_booking_id" "uuid", "p_checkout_session_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."klyx_release_expired_booking_checkout"("p_booking_id" "uuid", "p_checkout_session_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_release_split_checkout_13_27"("p_unit_id" "uuid", "p_checkout_session_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update
    public.split_booking_payment_units
  set
    status = 'expired',
    stripe_checkout_session_id = null,
    checkout_url = null,
    stripe_payment_intent_id = null,
    attempt_token = null,
    last_error =
      'checkout_expired',
    updated_at = now()
  where
    id = p_unit_id
    and stripe_checkout_session_id =
      p_checkout_session_id
    and status <> 'paid';

  return found;
end;
$$;


ALTER FUNCTION "public"."klyx_release_split_checkout_13_27"("p_unit_id" "uuid", "p_checkout_session_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_resolve_group_cancellation"("p_group_id" "uuid", "p_actor_profile_id" "uuid", "p_decision" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_group public.booking_groups%rowtype;
begin
  if p_decision not in (
    'approve',
    'reject'
  ) then
    raise exception
      'KLYX_GROUP_CANCEL_DECISION_INVALID';
  end if;

  select *
  into v_group
  from public.booking_groups
  where id = p_group_id
  for update;

  if not found then
    raise exception
      'KLYX_GROUP_CANCEL_NOT_FOUND';
  end if;

  if
    p_actor_profile_id <>
      v_group.client_profile_id
    and
    p_actor_profile_id <>
      v_group.provider_profile_id
  then
    raise exception
      'KLYX_GROUP_CANCEL_ACCESS_DENIED';
  end if;

  if
    v_group.cancellation_requested_by =
      p_actor_profile_id
  then
    raise exception
      'KLYX_GROUP_CANCEL_SELF_APPROVAL';
  end if;

  if
    v_group.cancellation_request_status <>
      'requested'
  then
    if
      p_decision = 'approve'
      and v_group.cancellation_resolution =
        'approved'
    then
      if
        v_group.payment_status = 'paid'
        and v_group.refund_status in (
          'processing',
          'failed',
          'review_required'
        )
      then
        return 'refund';
      end if;

      if
        v_group.refund_status = 'refunded'
      then
        return 'already_refunded';
      end if;

      return 'already_approved';
    end if;

    if
      p_decision = 'reject'
      and v_group.cancellation_resolution =
        'rejected'
    then
      return 'already_rejected';
    end if;

    raise exception
      'KLYX_GROUP_CANCEL_NOT_PENDING';
  end if;

  if p_decision = 'reject' then
    update public.booking_groups
    set
      cancellation_request_status =
        'resolved',

      cancellation_resolution =
        'rejected',

      cancellation_resolved_by =
        p_actor_profile_id,

      cancellation_resolved_at =
        now(),

      refund_status =
        'not_required',

      updated_at =
        now()
    where id =
      p_group_id;

    return 'rejected';
  end if;

  if
    v_group.payment_status = 'paid'
  then
    if
      v_group.stripe_payment_intent_id
        is null
    then
      raise exception
        'KLYX_GROUP_CANCEL_PAYMENT_INTENT_MISSING';
    end if;

    update public.booking_groups
    set
      cancellation_request_status =
        'resolved',

      cancellation_resolution =
        'approved',

      cancellation_resolved_by =
        p_actor_profile_id,

      cancellation_resolved_at =
        now(),

      refund_status =
        'processing',

      updated_at =
        now()
    where id =
      p_group_id;

    return 'refund';
  end if;

  insert into public.booking_status_events (
    booking_id,
    actor_id,
    previous_status,
    new_status,
    note
  )
  select
    id,
    p_actor_profile_id,
    status,
    'cancelled',
    'Mission groupee annulee apres accord explicite des deux participants.'
  from public.bookings
  where booking_group_id =
    p_group_id
    and status not in (
      'cancelled',
      'rejected',
      'completed'
    );

  update public.bookings
  set
    status =
      'cancelled',

    service_status =
      'cancelled',

    updated_at =
      now()
  where booking_group_id =
    p_group_id
    and status not in (
      'cancelled',
      'rejected',
      'completed'
    );

  update public.booking_groups
  set
    status =
      'cancelled',

    cancellation_request_status =
      'resolved',

    cancellation_resolution =
      'approved',

    cancellation_resolved_by =
      p_actor_profile_id,

    cancellation_resolved_at =
      now(),

    refund_status =
      'not_required',

    updated_at =
      now()
  where id =
    p_group_id;

  return 'cancelled';
end;
$$;


ALTER FUNCTION "public"."klyx_resolve_group_cancellation"("p_group_id" "uuid", "p_actor_profile_id" "uuid", "p_decision" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_security_audit"() RETURNS TABLE("table_name" "text", "rls_enabled" boolean, "policy_count" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
  select
    c.relname::text as table_name,
    c.relrowsecurity as rls_enabled,
    count(p.policyname)::bigint as policy_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n
    on n.oid = c.relnamespace
  left join pg_catalog.pg_policies p
    on p.schemaname = n.nspname
   and p.tablename = c.relname
  where
    n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (
      'profiles',
      'user_services',
      'service_profiles',
      'provider_profiles',
      'provider_service_zones',
      'availability_slots',
      'favorites',
      'bookings',
      'service_quotes',
      'messages',
      'reviews',
      'disputes',
      'notifications'
    )
  group by
    c.relname,
    c.relrowsecurity
  order by c.relname;
$$;


ALTER FUNCTION "public"."klyx_security_audit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_shares_booking_with_profile"("other_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.bookings booking
    where (
      booking.parent_id = other_profile_id
      or coalesce(booking.provider_id, booking.babysitter_id) = other_profile_id
    )
      and (
        public.klyx_owns_profile(booking.parent_id)
        or public.klyx_owns_profile(
          coalesce(booking.provider_id, booking.babysitter_id)
        )
      )
  );
$$;


ALTER FUNCTION "public"."klyx_shares_booking_with_profile"("other_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_split_batch_integrity_13_20"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actual_count integer;
begin
  select count(*)::integer
  into v_actual_count
  from public.split_booking_batch_items
  where batch_id = new.id;

  new.created_booking_count :=
    coalesce(
      v_actual_count,
      0
    );

  if
    new.status = 'created'
    and new.created_booking_count <>
      new.expected_booking_count
  then
    raise exception
      'KLYX_SPLIT_BATCH_INCOMPLETE:%/%',
      new.created_booking_count,
      new.expected_booking_count;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."klyx_split_batch_integrity_13_20"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_split_batch_item_count_13_20"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_batch_id uuid;
begin
  v_batch_id :=
    coalesce(
      new.batch_id,
      old.batch_id
    );

  update public.split_booking_batches
  set
    created_booking_count = (
      select count(*)::integer
      from public.split_booking_batch_items
      where batch_id = v_batch_id
    ),
    updated_at = now()
  where id = v_batch_id;

  return coalesce(
    new,
    old
  );
end;
$$;


ALTER FUNCTION "public"."klyx_split_batch_item_count_13_20"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."klyx_valid_message_participants"("booking_id" "uuid", "sender_id" "uuid", "receiver_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.bookings booking
    where booking.id = booking_id
      and (
        (
          booking.parent_id = sender_id
          and coalesce(booking.provider_id, booking.babysitter_id) = receiver_id
        )
        or (
          booking.parent_id = receiver_id
          and coalesce(booking.provider_id, booking.babysitter_id) = sender_id
        )
      )
  );
$$;


ALTER FUNCTION "public"."klyx_valid_message_participants"("booking_id" "uuid", "sender_id" "uuid", "receiver_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_booking_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if old.status is distinct from new.status then
    if new.status = 'accepted' then
      insert into public.notifications (user_id, title, body, type)
      values (
        new.parent_id,
        'Réservation acceptée',
        'Votre demande de réservation a été acceptée.',
        'booking_accepted'
      );
    elsif new.status = 'rejected' then
      insert into public.notifications (user_id, title, body, type)
      values (
        new.parent_id,
        'Réservation refusée',
        'Votre demande de réservation a été refusée.',
        'booking_rejected'
      );
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."notify_booking_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_new_booking"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  recipient_profile_id uuid;
begin
  recipient_profile_id :=
    coalesce(new.provider_id, new.babysitter_id);

  if recipient_profile_id is null then
    return new;
  end if;

  insert into public.user_notifications (
    user_id,
    booking_id,
    type,
    title,
    message,
    href,
    deduplication_key
  )
  values (
    recipient_profile_id,
    new.id,
    'booking_created',
    'Nouvelle demande reçue',
    'Vous avez reçu une nouvelle demande de réservation.',
    '/bookings/' || new.id::text,
    'booking_created:' || new.id::text
  )
  on conflict (deduplication_key) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."notify_new_booking"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_new_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  recipient_profile_id uuid;
begin
  select
    case
      when new.sender_id = booking.parent_id
        then coalesce(
          booking.provider_id,
          booking.babysitter_id
        )
      else booking.parent_id
    end
  into recipient_profile_id
  from public.bookings as booking
  where booking.id = new.booking_id;

  if recipient_profile_id is null then
    return new;
  end if;

  if recipient_profile_id = new.sender_id then
    return new;
  end if;

  insert into public.user_notifications (
    user_id,
    booking_id,
    type,
    title,
    message,
    href,
    deduplication_key
  )
  values (
    recipient_profile_id,
    new.booking_id,
    'system',
    'Nouveau message',
    'Vous avez reçu un nouveau message concernant une réservation.',
    '/messages/' || new.booking_id::text,
    'message:' || new.id::text
  )
  on conflict (deduplication_key) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."notify_new_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_service_profile_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  affected_target uuid;
begin
  affected_target := coalesce(new.target_id, old.target_id);

  update public.service_profiles sp
  set
    rating = coalesce((
      select round(avg(r.rating)::numeric, 2)
      from public.reviews r
      where r.target_id = affected_target
    ), 0),
    review_count = (
      select count(*)
      from public.reviews r
      where r.target_id = affected_target
    ),
    updated_at = now()
  where sp.user_service_id in (
    select us.id
    from public.user_services us
    join public.services s on s.id = us.service_id
    where us.user_id = affected_target
      and s.slug = 'babysitting'
  );

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."refresh_service_profile_rating"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_booking_availability"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  booking_day integer;
  matching_slot_exists boolean;
begin
  if new.parent_id = new.babysitter_id then
    raise exception 'Vous ne pouvez pas réserver votre propre profil.';
  end if;

  booking_day := extract(dow from new.booking_date)::integer;

  select exists (
    select 1
    from public.user_services us
    join public.services s
      on s.id = us.service_id
    join public.availability_slots a
      on a.user_service_id = us.id
    where us.user_id = new.babysitter_id
      and us.active = true
      and s.slug = 'babysitting'
      and a.is_active = true
      and a.day_of_week = booking_day
      and new.start_time >= a.start_time
      and new.end_time <= a.end_time
  )
  into matching_slot_exists;

  if not matching_slot_exists then
    raise exception 'Ce créneau est en dehors des disponibilités du prestataire.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validate_booking_availability"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."availability_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_service_id" "uuid" NOT NULL,
    "day_of_week" smallint NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "availability_slots_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "availability_time_check" CHECK (("end_time" > "start_time"))
);


ALTER TABLE "public"."availability_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_financial_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "entry_key" "text" NOT NULL,
    "entry_type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "gross_amount_cents" integer DEFAULT 0 NOT NULL,
    "platform_fee_cents" integer DEFAULT 0 NOT NULL,
    "provider_amount_cents" integer,
    "refund_amount_cents" integer DEFAULT 0 NOT NULL,
    "payment_mode" "text",
    "stripe_checkout_session_id" "text",
    "stripe_payment_intent_id" "text",
    "stripe_refund_id" "text",
    "failure_code" "text",
    "failure_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "booking_financial_ledger_entry_type_check" CHECK (("entry_type" = ANY (ARRAY['payment_succeeded'::"text", 'payment_failed'::"text", 'refund_succeeded'::"text", 'refund_failed'::"text"]))),
    CONSTRAINT "booking_financial_ledger_status_check" CHECK (("status" = ANY (ARRAY['succeeded'::"text", 'failed'::"text", 'processing'::"text"])))
);


ALTER TABLE "public"."booking_financial_ledger" OWNER TO "postgres";


COMMENT ON TABLE "public"."booking_financial_ledger" IS 'Journal financier serveur KLYX. Une ecriture immutable-logique par evenement financier.';



CREATE TABLE IF NOT EXISTS "public"."booking_group_cancellation_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_group_id" "uuid" NOT NULL,
    "actor_profile_id" "uuid" NOT NULL,
    "actor_role" "text" NOT NULL,
    "action" "text" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "booking_group_cancellation_events_action_check" CHECK (("action" = ANY (ARRAY['requested'::"text", 'withdrawn'::"text", 'resolved'::"text", 'approved'::"text", 'rejected'::"text", 'refund_started'::"text", 'refund_succeeded'::"text", 'refund_failed'::"text"]))),
    CONSTRAINT "booking_group_cancellation_events_actor_role_check" CHECK (("actor_role" = ANY (ARRAY['client'::"text", 'provider'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."booking_group_cancellation_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "market_request_id" "uuid" NOT NULL,
    "client_profile_id" "uuid" NOT NULL,
    "provider_profile_id" "uuid" NOT NULL,
    "user_service_id" "uuid" NOT NULL,
    "offer_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending_provider'::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "total_amount_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "slot_count" integer NOT NULL,
    "selected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payment_mode" "text",
    "application_fee_amount" integer,
    "platform_fee_amount" integer,
    "provider_amount" integer,
    "stripe_checkout_session_id" "text",
    "stripe_payment_intent_id" "text",
    "payment_attempt_token" "uuid",
    "payment_attempt_count" integer DEFAULT 0 NOT NULL,
    "payment_checkout_started_at" timestamp with time zone,
    "payment_failure_code" "text",
    "payment_failure_message" "text",
    "payment_failed_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "cancellation_request_status" "text" DEFAULT 'none'::"text" NOT NULL,
    "cancellation_requested_by" "uuid",
    "cancellation_requested_role" "text",
    "cancellation_reason" "text",
    "cancellation_requested_at" timestamp with time zone,
    "cancellation_withdrawn_at" timestamp with time zone,
    "refund_status" "text" DEFAULT 'not_required'::"text" NOT NULL,
    "cancellation_resolution" "text" DEFAULT 'none'::"text" NOT NULL,
    "cancellation_resolved_by" "uuid",
    "cancellation_resolved_at" timestamp with time zone,
    "stripe_refund_id" "text",
    "refunded_amount_cents" integer,
    "refunded_at" timestamp with time zone,
    CONSTRAINT "booking_groups_amount_check" CHECK (("total_amount_cents" > 0)),
    CONSTRAINT "booking_groups_cancellation_request_status_check" CHECK (("cancellation_request_status" = ANY (ARRAY['none'::"text", 'requested'::"text", 'withdrawn'::"text", 'resolved'::"text"]))),
    CONSTRAINT "booking_groups_cancellation_requested_role_check" CHECK ((("cancellation_requested_role" IS NULL) OR ("cancellation_requested_role" = ANY (ARRAY['client'::"text", 'provider'::"text"])))),
    CONSTRAINT "booking_groups_cancellation_resolution_check" CHECK (("cancellation_resolution" = ANY (ARRAY['none'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "booking_groups_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'processing'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text"]))),
    CONSTRAINT "booking_groups_refund_status_check" CHECK (("refund_status" = ANY (ARRAY['not_required'::"text", 'review_required'::"text", 'processing'::"text", 'refunded'::"text", 'failed'::"text"]))),
    CONSTRAINT "booking_groups_refunded_amount_check" CHECK ((("refunded_amount_cents" IS NULL) OR ("refunded_amount_cents" >= 0))),
    CONSTRAINT "booking_groups_slot_count_check" CHECK ((("slot_count" >= 2) AND ("slot_count" <= 20))),
    CONSTRAINT "booking_groups_status_check" CHECK (("status" = ANY (ARRAY['pending_provider'::"text", 'accepted'::"text", 'rejected'::"text", 'cancelled'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."booking_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_status_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "previous_status" "text",
    "new_status" "text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "booking_status_events_status_check" CHECK ((("new_status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'cancelled'::"text", 'completed'::"text"])) AND (("previous_status" IS NULL) OR ("previous_status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'cancelled'::"text", 'completed'::"text"])))))
);


ALTER TABLE "public"."booking_status_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_tracking_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "booking_tracking_events_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'en_route'::"text", 'arrived'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."booking_tracking_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "babysitter_id" "uuid" NOT NULL,
    "parent_id" "uuid" NOT NULL,
    "booking_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "payment_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "amount_total" integer,
    "stripe_checkout_session_id" "text",
    "stripe_payment_intent_id" "text",
    "paid_at" timestamp with time zone,
    "platform_fee_amount" integer,
    "provider_amount" integer,
    "payment_mode" "text",
    "application_fee_amount" integer,
    "provider_id" "uuid",
    "service_id" "uuid",
    "user_service_id" "uuid",
    "service_status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "en_route_at" timestamp with time zone,
    "arrived_at" timestamp with time zone,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "pricing_type_snapshot" "text",
    "unit_price_cents" integer,
    "estimated_amount_cents" integer,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "cancellation_reason" "text",
    "provider_response" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payment_attempt_token" "uuid",
    "payment_attempt_number" integer DEFAULT 0 NOT NULL,
    "payment_checkout_started_at" timestamp with time zone,
    "payment_failure_code" "text",
    "payment_failure_message" "text",
    "payment_failed_at" timestamp with time zone,
    "refund_status" "text",
    "stripe_refund_id" "text",
    "refunded_amount_cents" integer,
    "refunded_at" timestamp with time zone,
    "refund_reason" "text",
    "refund_requested_by" "uuid",
    "provider_finished_at" timestamp with time zone,
    "provider_finish_note" "text",
    "client_confirmed_at" timestamp with time zone,
    "quote_id" "uuid",
    "booking_group_id" "uuid",
    "group_position" integer,
    CONSTRAINT "bookings_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "bookings_group_position_check" CHECK ((("group_position" IS NULL) OR (("group_position" >= 1) AND ("group_position" <= 20)))),
    CONSTRAINT "bookings_payment_attempt_number_check" CHECK (("payment_attempt_number" >= 0)),
    CONSTRAINT "bookings_payment_mode_check" CHECK ((("payment_mode" IS NULL) OR ("payment_mode" = ANY (ARRAY['connect_destination'::"text", 'platform_test_only'::"text"])))),
    CONSTRAINT "bookings_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'creating_checkout'::"text", 'checkout_created'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text"]))),
    CONSTRAINT "bookings_platform_fee_amount_check" CHECK ((("platform_fee_amount" IS NULL) OR ("platform_fee_amount" >= 0))),
    CONSTRAINT "bookings_price_amounts_check" CHECK (((("unit_price_cents" IS NULL) OR ("unit_price_cents" >= 0)) AND (("estimated_amount_cents" IS NULL) OR ("estimated_amount_cents" >= 0)))),
    CONSTRAINT "bookings_pricing_snapshot_check" CHECK ((("pricing_type_snapshot" IS NULL) OR ("pricing_type_snapshot" = ANY (ARRAY['hourly'::"text", 'fixed'::"text"])))),
    CONSTRAINT "bookings_provider_amount_check" CHECK ((("provider_amount" IS NULL) OR ("provider_amount" >= 0))),
    CONSTRAINT "bookings_refund_status_check" CHECK ((("refund_status" IS NULL) OR ("refund_status" = ANY (ARRAY['processing'::"text", 'succeeded'::"text", 'failed'::"text"])))),
    CONSTRAINT "bookings_service_status_check" CHECK (("service_status" = ANY (ARRAY['scheduled'::"text", 'en_route'::"text", 'arrived'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brain_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'Nouvelle conversation'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."brain_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brain_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."brain_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_agent_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "raw_request" "text" NOT NULL,
    "service_slug" "text",
    "city" "text",
    "requested_day" "date",
    "requested_time" time without time zone,
    "duration_hours" numeric(5,2),
    "budget_max" numeric(12,2),
    "plan_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "steps" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "memory_used" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "client_agent_plans_budget_check" CHECK ((("budget_max" IS NULL) OR ("budget_max" >= (0)::numeric))),
    CONSTRAINT "client_agent_plans_duration_check" CHECK ((("duration_hours" IS NULL) OR (("duration_hours" > (0)::numeric) AND ("duration_hours" <= (24)::numeric)))),
    CONSTRAINT "client_agent_plans_status_check" CHECK (("plan_status" = ANY (ARRAY['draft'::"text", 'ready'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."client_agent_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_memory_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "household_type" "text",
    "children_count" integer DEFAULT 0 NOT NULL,
    "pet_types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "preferred_languages" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "access_notes" "text",
    "cleaning_notes" "text",
    "babysitting_notes" "text",
    "moving_notes" "text",
    "handyman_notes" "text",
    "memory_enabled" boolean DEFAULT true NOT NULL,
    "last_confirmed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_memory_profiles_children_count_check" CHECK ((("children_count" >= 0) AND ("children_count" <= 20))),
    CONSTRAINT "client_memory_profiles_household_type_check" CHECK ((("household_type" IS NULL) OR ("household_type" = ANY (ARRAY['apartment'::"text", 'house'::"text", 'studio'::"text", 'office'::"text", 'other'::"text"]))))
);


ALTER TABLE "public"."client_memory_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dispute_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dispute_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "event_type" "text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dispute_events_type_check" CHECK (("event_type" = ANY (ARRAY['opened'::"text", 'message'::"text", 'status_changed'::"text", 'resolved'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."dispute_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."disputes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "opened_by" "uuid" NOT NULL,
    "against_profile_id" "uuid",
    "reason" "text" NOT NULL,
    "description" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "resolution" "text",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_admin_user_id" "uuid",
    "decision_code" "text",
    "decision_note" "text",
    "last_reviewed_at" timestamp with time zone,
    CONSTRAINT "disputes_decision_code_check" CHECK ((("decision_code" IS NULL) OR ("decision_code" = ANY (ARRAY['no_action'::"text", 'warning_recorded'::"text", 'refund_review_required'::"text", 'provider_compensation_review'::"text", 'more_information_required'::"text", 'safety_escalation'::"text"])))),
    CONSTRAINT "disputes_description_length_check" CHECK ((("char_length"("description") >= 20) AND ("char_length"("description") <= 2000))),
    CONSTRAINT "disputes_priority_check" CHECK (("priority" = ANY (ARRAY['normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "disputes_reason_check" CHECK (("reason" = ANY (ARRAY['provider_absent'::"text", 'client_absent'::"text", 'major_delay'::"text", 'unfinished_work'::"text", 'unsatisfactory_work'::"text", 'unsafe_behavior'::"text", 'payment_problem'::"text", 'other'::"text"]))),
    CONSTRAINT "disputes_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'under_review'::"text", 'waiting_user'::"text", 'resolved'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."disputes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "service_profile_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."market_request_provider_candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "market_request_id" "uuid" NOT NULL,
    "provider_profile_id" "uuid" NOT NULL,
    "coverage_count" integer NOT NULL,
    "slot_count" integer NOT NULL,
    "full_coverage" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "market_request_provider_candidates_coverage_check" CHECK ((("coverage_count" >= 0) AND ("coverage_count" <= "slot_count") AND ("slot_count" >= 1)))
);


ALTER TABLE "public"."market_request_provider_candidates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."market_service_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "provider_profile_id" "uuid" NOT NULL,
    "user_service_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "message" "text",
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "market_service_offers_amount_check" CHECK ((("amount" >= (0)::numeric) AND ("amount" <= (1000000)::numeric))),
    CONSTRAINT "market_service_offers_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'accepted'::"text", 'rejected'::"text", 'withdrawn'::"text"])))
);


ALTER TABLE "public"."market_service_offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."market_service_request_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "market_request_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "requested_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "budget_max" numeric(12,2),
    "duration_minutes" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "market_service_request_slots_budget_check" CHECK ((("budget_max" IS NULL) OR ("budget_max" >= (0)::numeric))),
    CONSTRAINT "market_service_request_slots_duration_check" CHECK ((("duration_minutes" > 0) AND ("duration_minutes" <= 1440))),
    CONSTRAINT "market_service_request_slots_position_check" CHECK ((("position" >= 1) AND ("position" <= 20))),
    CONSTRAINT "market_service_request_slots_time_check" CHECK (("start_time" <> "end_time"))
);


ALTER TABLE "public"."market_service_request_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."market_service_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_profile_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "city" "text" NOT NULL,
    "requested_date" "date",
    "requested_time" time without time zone,
    "budget_max" numeric(12,2),
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "accepted_offer_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "request_mode" "text" DEFAULT 'single'::"text" NOT NULL,
    "slot_count" integer DEFAULT 1 NOT NULL,
    "budget_total" numeric(12,2),
    "prefer_single_provider" boolean DEFAULT true NOT NULL,
    CONSTRAINT "market_service_requests_budget_total_check" CHECK ((("budget_total" IS NULL) OR ("budget_total" >= (0)::numeric))),
    CONSTRAINT "market_service_requests_request_mode_check" CHECK (("request_mode" = ANY (ARRAY['single'::"text", 'multi_slot'::"text"]))),
    CONSTRAINT "market_service_requests_slot_count_check" CHECK ((("slot_count" >= 1) AND ("slot_count" <= 20))),
    CONSTRAINT "market_service_requests_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'matched'::"text", 'cancelled'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."market_service_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."market_split_plan_confirmations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "market_request_id" "uuid" NOT NULL,
    "client_profile_id" "uuid" NOT NULL,
    "plan_hash" "text" NOT NULL,
    "plan_snapshot" "jsonb" NOT NULL,
    "slot_count" integer NOT NULL,
    "provider_count" integer NOT NULL,
    "confirmed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invalidated_at" timestamp with time zone,
    "invalidation_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "klyx_split_plan_hash_13_19i" CHECK (("char_length"("plan_hash") = 64)),
    CONSTRAINT "klyx_split_plan_provider_count_13_19i" CHECK (("provider_count" >= 2)),
    CONSTRAINT "klyx_split_plan_slot_count_13_19i" CHECK (("slot_count" >= 2))
);


ALTER TABLE "public"."market_split_plan_confirmations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "receiver_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "type" "text",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."phone_contact_access_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "viewer_profile_id" "uuid" NOT NULL,
    "contact_profile_id" "uuid" NOT NULL,
    "event_type" "text" DEFAULT 'phone_reveal'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."phone_contact_access_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."phone_contact_access_logs" IS 'KLYX server-only audit trail for authorized phone reveals.';



CREATE TABLE IF NOT EXISTS "public"."phone_verification_limits" (
    "profile_id" "uuid" NOT NULL,
    "last_sent_at" timestamp with time zone,
    "failed_attempts" integer DEFAULT 0 NOT NULL,
    "locked_until" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."phone_verification_limits" OWNER TO "postgres";


COMMENT ON TABLE "public"."phone_verification_limits" IS 'KLYX server-only OTP anti-abuse state.';



CREATE TABLE IF NOT EXISTS "public"."photo_service_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "original_name" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "size_bytes" bigint NOT NULL,
    "width" integer,
    "height" integer,
    "user_description" "text" NOT NULL,
    "detected_service_slug" "text",
    "analysis_mode" "text" DEFAULT 'description_assisted'::"text" NOT NULL,
    "analysis_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'analyzed'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "photo_service_requests_analysis_mode_check" CHECK (("analysis_mode" = ANY (ARRAY['description_assisted'::"text", 'vision_ai'::"text"]))),
    CONSTRAINT "photo_service_requests_size_check" CHECK ((("size_bytes" > 0) AND ("size_bytes" <= 10485760))),
    CONSTRAINT "photo_service_requests_status_check" CHECK (("status" = ANY (ARRAY['uploaded'::"text", 'analyzed'::"text", 'converted_to_search'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."photo_service_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_risk_assessments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "risk_score" integer DEFAULT 0 NOT NULL,
    "risk_level" "text" DEFAULT 'low'::"text" NOT NULL,
    "signals" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "recommendations" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "assessed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profile_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['low'::"text", 'moderate'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "profile_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "public"."profile_risk_assessments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "role" "text" DEFAULT 'client'::"text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "first_name" "text",
    "last_name" "text",
    "age" integer,
    "city" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "stripe_account_id" "text",
    "stripe_onboarding_complete" boolean DEFAULT false NOT NULL,
    "stripe_charges_enabled" boolean DEFAULT false NOT NULL,
    "stripe_payouts_enabled" boolean DEFAULT false NOT NULL,
    "current_mode" "text" DEFAULT 'client'::"text" NOT NULL,
    "account_type" "text" DEFAULT 'client'::"text" NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "phone_number" "text",
    "phone_verified_at" timestamp with time zone,
    "phone_visibility" "text" DEFAULT 'transaction_participants'::"text" NOT NULL,
    CONSTRAINT "profiles_account_type_check" CHECK (("account_type" = ANY (ARRAY['client'::"text", 'provider'::"text"]))),
    CONSTRAINT "profiles_current_mode_check" CHECK (("current_mode" = ANY (ARRAY['client'::"text", 'provider'::"text"]))),
    CONSTRAINT "profiles_phone_visibility_check" CHECK (("phone_visibility" = ANY (ARRAY['private'::"text", 'transaction_participants'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."phone_number" IS 'Numero de telephone KLYX au format international E.164.';



COMMENT ON COLUMN "public"."profiles"."phone_verified_at" IS 'Date de verification OTP du numero de telephone.';



COMMENT ON COLUMN "public"."profiles"."phone_visibility" IS 'Controle la visibilite du numero. Jamais public par defaut.';



CREATE TABLE IF NOT EXISTS "public"."project_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "service_slug" "text" NOT NULL,
    "service_label" "text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "estimated_price_min" numeric(12,2),
    "estimated_price_max" numeric(12,2),
    "notes" "text",
    "status" "text" DEFAULT 'suggested'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "project_services_status_check" CHECK (("status" = ANY (ARRAY['suggested'::"text", 'selected'::"text", 'booked'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."project_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "project_type" "text",
    "city" "text",
    "target_date" "date",
    "budget_max" numeric(12,2),
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "projects_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'planned'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_assistant_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "draft_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_at" timestamp with time zone,
    CONSTRAINT "provider_assistant_drafts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'applied'::"text", 'discarded'::"text"]))),
    CONSTRAINT "provider_assistant_drafts_type_check" CHECK (("draft_type" = ANY (ARRAY['availability'::"text", 'client_reply'::"text", 'quote'::"text"])))
);


ALTER TABLE "public"."provider_assistant_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_documents_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text"]))),
    CONSTRAINT "provider_documents_type_check" CHECK (("document_type" = ANY (ARRAY['identity'::"text", 'address'::"text", 'insurance'::"text", 'company'::"text"])))
);


ALTER TABLE "public"."provider_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_gallery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "caption" "text",
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."provider_gallery" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_profiles" (
    "profile_id" "uuid" NOT NULL,
    "business_name" "text",
    "headline" "text",
    "bio" "text",
    "years_experience" integer DEFAULT 0 NOT NULL,
    "is_published" boolean DEFAULT false NOT NULL,
    "verification_status" "text" DEFAULT 'not_submitted'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_profiles_verification_check" CHECK (("verification_status" = ANY (ARRAY['not_submitted'::"text", 'pending'::"text", 'verified'::"text", 'rejected'::"text"]))),
    CONSTRAINT "provider_profiles_years_check" CHECK ((("years_experience" >= 0) AND ("years_experience" <= 60)))
);


ALTER TABLE "public"."provider_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_service_zones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "user_service_id" "uuid" NOT NULL,
    "country_code" "text" DEFAULT 'BE'::"text" NOT NULL,
    "locality" "text" NOT NULL,
    "postal_code" "text",
    "radius_km" integer DEFAULT 10 NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_service_zones_country_check" CHECK (("char_length"("country_code") = 2)),
    CONSTRAINT "provider_service_zones_locality_check" CHECK ((("char_length"(TRIM(BOTH FROM "locality")) >= 2) AND ("char_length"(TRIM(BOTH FROM "locality")) <= 100))),
    CONSTRAINT "provider_service_zones_radius_check" CHECK ((("radius_km" >= 1) AND ("radius_km" <= 100)))
);


ALTER TABLE "public"."provider_service_zones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_skill_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "verification_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "user_service_id" "uuid" NOT NULL,
    "proof_type" "text" NOT NULL,
    "original_name" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "size_bytes" bigint NOT NULL,
    "status" "text" DEFAULT 'uploaded'::"text" NOT NULL,
    "rejection_reason" "text",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    CONSTRAINT "provider_skill_documents_proof_type_check" CHECK (("proof_type" = ANY (ARRAY['diploma'::"text", 'training_certificate'::"text", 'professional_license'::"text", 'insurance'::"text", 'experience_reference'::"text", 'portfolio'::"text", 'other'::"text"]))),
    CONSTRAINT "provider_skill_documents_size_bytes_check" CHECK ((("size_bytes" > 0) AND ("size_bytes" <= 10485760))),
    CONSTRAINT "provider_skill_documents_status_check" CHECK (("status" = ANY (ARRAY['uploaded'::"text", 'under_review'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."provider_skill_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."provider_skill_documents" IS 'Preuves privees attachees a une competence/metier precis.';



CREATE TABLE IF NOT EXISTS "public"."provider_skill_verifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "user_service_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'not_started'::"text" NOT NULL,
    "provider_statement" "text",
    "years_experience" integer,
    "submitted_at" timestamp with time zone,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "review_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_skill_verifications_status_check" CHECK (("status" = ANY (ARRAY['not_started'::"text", 'submitted'::"text", 'under_review'::"text", 'approved'::"text", 'changes_required'::"text", 'rejected'::"text"]))),
    CONSTRAINT "provider_skill_verifications_years_experience_check" CHECK ((("years_experience" IS NULL) OR (("years_experience" >= 0) AND ("years_experience" <= 80))))
);


ALTER TABLE "public"."provider_skill_verifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."provider_skill_verifications" IS 'Un dossier de competence KLYX par profil prestataire et par user_service.';



CREATE TABLE IF NOT EXISTS "public"."provider_verification_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "original_name" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "size_bytes" bigint NOT NULL,
    "status" "text" DEFAULT 'uploaded'::"text" NOT NULL,
    "rejection_reason" "text",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_verification_documents_size_check" CHECK ((("size_bytes" > 0) AND ("size_bytes" <= 10485760))),
    CONSTRAINT "provider_verification_documents_status_check" CHECK (("status" = ANY (ARRAY['uploaded'::"text", 'under_review'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "provider_verification_documents_type_check" CHECK (("document_type" = ANY (ARRAY['identity'::"text", 'address'::"text", 'business'::"text", 'insurance'::"text", 'professional_certificate'::"text"])))
);


ALTER TABLE "public"."provider_verification_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_verifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'not_started'::"text" NOT NULL,
    "identity_status" "text" DEFAULT 'missing'::"text" NOT NULL,
    "address_status" "text" DEFAULT 'missing'::"text" NOT NULL,
    "business_status" "text" DEFAULT 'optional'::"text" NOT NULL,
    "insurance_status" "text" DEFAULT 'optional'::"text" NOT NULL,
    "professional_status" "text" DEFAULT 'optional'::"text" NOT NULL,
    "trust_level" "text" DEFAULT 'new'::"text" NOT NULL,
    "submitted_at" timestamp with time zone,
    "reviewed_at" timestamp with time zone,
    "review_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "external_provider" "text",
    "external_applicant_id" "text",
    "external_review_status" "text",
    "external_review_answer" "text",
    "external_reject_type" "text",
    "external_moderation_comment" "text",
    "external_sandbox_mode" boolean,
    "external_updated_at" timestamp with time zone,
    CONSTRAINT "provider_verifications_document_status_check" CHECK ((("identity_status" = ANY (ARRAY['missing'::"text", 'uploaded'::"text", 'under_review'::"text", 'approved'::"text", 'rejected'::"text"])) AND ("address_status" = ANY (ARRAY['missing'::"text", 'uploaded'::"text", 'under_review'::"text", 'approved'::"text", 'rejected'::"text"])) AND ("business_status" = ANY (ARRAY['optional'::"text", 'missing'::"text", 'uploaded'::"text", 'under_review'::"text", 'approved'::"text", 'rejected'::"text"])) AND ("insurance_status" = ANY (ARRAY['optional'::"text", 'missing'::"text", 'uploaded'::"text", 'under_review'::"text", 'approved'::"text", 'rejected'::"text"])) AND ("professional_status" = ANY (ARRAY['optional'::"text", 'missing'::"text", 'uploaded'::"text", 'under_review'::"text", 'approved'::"text", 'rejected'::"text"])))),
    CONSTRAINT "provider_verifications_status_check" CHECK (("status" = ANY (ARRAY['not_started'::"text", 'incomplete'::"text", 'submitted'::"text", 'under_review'::"text", 'approved'::"text", 'changes_required'::"text", 'rejected'::"text"]))),
    CONSTRAINT "provider_verifications_trust_level_check" CHECK (("trust_level" = ANY (ARRAY['new'::"text", 'identity_verified'::"text", 'professional'::"text", 'expert'::"text"])))
);


ALTER TABLE "public"."provider_verifications" OWNER TO "postgres";


COMMENT ON COLUMN "public"."provider_verifications"."external_review_answer" IS 'Decision finale du fournisseur externe, par exemple GREEN ou RED.';



CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "booking_group_id" "uuid",
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "alert_type" "text" NOT NULL,
    "severity" "text" DEFAULT 'info'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "deduplication_key" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "security_alerts_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warning'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "security_alerts_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'acknowledged'::"text", 'resolved'::"text"]))),
    CONSTRAINT "security_alerts_type_check" CHECK (("alert_type" = ANY (ARRAY['repeated_cancellations'::"text", 'multiple_disputes'::"text", 'payment_failures'::"text", 'identity_incomplete'::"text", 'unusual_activity'::"text", 'safety_report'::"text"])))
);


ALTER TABLE "public"."security_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_service_id" "uuid" NOT NULL,
    "title" "text",
    "description" "text",
    "price" numeric,
    "city" "text",
    "experience" "text",
    "languages" "text",
    "children_age" "text",
    "permit" boolean DEFAULT false,
    "smoker" boolean DEFAULT false,
    "rating" numeric DEFAULT 0,
    "review_count" integer DEFAULT 0,
    "available" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "klyx_score" numeric(5,2) DEFAULT 50 NOT NULL,
    "completed_jobs" integer DEFAULT 0 NOT NULL,
    "cancellation_rate" numeric(5,2) DEFAULT 0 NOT NULL,
    "last_score_at" timestamp with time zone,
    "pricing_type" "text" DEFAULT 'hourly'::"text" NOT NULL,
    "service_area" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "travel_radius_km" integer DEFAULT 10 NOT NULL,
    "hourly_price" numeric(10,2),
    "fixed_price" numeric(10,2),
    CONSTRAINT "service_profiles_fixed_price_check" CHECK ((("fixed_price" IS NULL) OR (("fixed_price" >= (1)::numeric) AND ("fixed_price" <= (10000)::numeric)))),
    CONSTRAINT "service_profiles_hourly_price_check" CHECK ((("hourly_price" IS NULL) OR (("hourly_price" >= (1)::numeric) AND ("hourly_price" <= (10000)::numeric)))),
    CONSTRAINT "service_profiles_pricing_type_check" CHECK (("pricing_type" = ANY (ARRAY['hourly'::"text", 'fixed'::"text"]))),
    CONSTRAINT "service_profiles_travel_radius_check" CHECK ((("travel_radius_km" >= 0) AND ("travel_radius_km" <= 100)))
);


ALTER TABLE "public"."service_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "proposed_name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text" NOT NULL,
    "experience_details" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "admin_note" "text",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "service_proposals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."service_proposals" OWNER TO "postgres";


COMMENT ON TABLE "public"."service_proposals" IS 'Métiers proposés par les prestataires avant validation et ajout au catalogue KLYX.';



CREATE TABLE IF NOT EXISTS "public"."service_quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_profile_id" "uuid" NOT NULL,
    "provider_profile_id" "uuid" NOT NULL,
    "user_service_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "requested_date" "date",
    "requested_time" time without time zone,
    "duration_hours" numeric(6,2),
    "pricing_type" "text" NOT NULL,
    "unit_price" numeric(12,2),
    "quantity" numeric(8,2) DEFAULT 1 NOT NULL,
    "estimated_total" numeric(12,2),
    "provider_price" numeric(12,2),
    "provider_message" "text",
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "expires_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "market_request_id" "uuid",
    CONSTRAINT "service_quotes_duration_check" CHECK ((("duration_hours" IS NULL) OR (("duration_hours" > (0)::numeric) AND ("duration_hours" <= (48)::numeric)))),
    CONSTRAINT "service_quotes_prices_check" CHECK (((("unit_price" IS NULL) OR ("unit_price" >= (0)::numeric)) AND (("estimated_total" IS NULL) OR ("estimated_total" >= (0)::numeric)) AND (("provider_price" IS NULL) OR ("provider_price" >= (0)::numeric)))),
    CONSTRAINT "service_quotes_pricing_type_check" CHECK (("pricing_type" = ANY (ARRAY['hourly'::"text", 'fixed'::"text"]))),
    CONSTRAINT "service_quotes_profiles_different" CHECK (("client_profile_id" <> "provider_profile_id")),
    CONSTRAINT "service_quotes_quantity_check" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "service_quotes_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'sent'::"text", 'accepted'::"text", 'rejected'::"text", 'cancelled'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."service_quotes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "raw_text" "text" NOT NULL,
    "detected_service_slug" "text",
    "city" "text",
    "requested_date" timestamp with time zone,
    "status" "text" DEFAULT 'analyzed'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "requested_day" "date",
    "requested_time" time without time zone,
    "budget_max" numeric(10,2),
    "people_count" integer,
    "urgency" "text",
    "parsed_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "service_requests_people_count_check" CHECK ((("people_count" IS NULL) OR ("people_count" > 0))),
    CONSTRAINT "service_requests_urgency_check" CHECK ((("urgency" IS NULL) OR ("urgency" = ANY (ARRAY['normal'::"text", 'today'::"text", 'urgent'::"text"]))))
);


ALTER TABLE "public"."service_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "icon" "text",
    "color" "text",
    "description" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."skill_qualification_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_code" "text" NOT NULL,
    "service_slug" "text" NOT NULL,
    "rule_level" "text" DEFAULT 'evidence_required'::"text" NOT NULL,
    "required_proof_types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "accepted_proof_types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "minimum_years_experience" integer DEFAULT 0 NOT NULL,
    "identity_required" boolean DEFAULT true NOT NULL,
    "insurance_required" boolean DEFAULT false NOT NULL,
    "official_registration_required" boolean DEFAULT false NOT NULL,
    "official_registration_label" "text",
    "legal_note" "text",
    "source_url" "text",
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "skill_qualification_rules_minimum_years_experience_check" CHECK ((("minimum_years_experience" >= 0) AND ("minimum_years_experience" <= 80))),
    CONSTRAINT "skill_qualification_rules_rule_level_check" CHECK (("rule_level" = ANY (ARRAY['self_declared'::"text", 'evidence_required'::"text", 'regulated'::"text"])))
);


ALTER TABLE "public"."skill_qualification_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."split_booking_batch_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "slot_id" "text" NOT NULL,
    "slot_position" integer NOT NULL,
    "provider_profile_id" "uuid" NOT NULL,
    "user_service_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "klyx_split_booking_item_position_13_19" CHECK (("slot_position" >= 1))
);


ALTER TABLE "public"."split_booking_batch_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."split_booking_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "market_request_id" "uuid" NOT NULL,
    "client_profile_id" "uuid" NOT NULL,
    "confirmation_id" "uuid" NOT NULL,
    "plan_hash" "text" NOT NULL,
    "status" "text" DEFAULT 'creating'::"text" NOT NULL,
    "expected_booking_count" integer NOT NULL,
    "provider_count" integer NOT NULL,
    "created_booking_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "failure_reason" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "klyx_split_booking_batch_count_13_19" CHECK ((("expected_booking_count" >= 2) AND ("provider_count" >= 2) AND ("created_booking_count" >= 0))),
    CONSTRAINT "klyx_split_booking_batch_hash_13_19" CHECK (("char_length"("plan_hash") = 64)),
    CONSTRAINT "klyx_split_booking_batch_status_13_19" CHECK (("status" = ANY (ARRAY['creating'::"text", 'created'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."split_booking_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."split_booking_payment_confirmations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "client_profile_id" "uuid" NOT NULL,
    "price_confirmation_id" "uuid" NOT NULL,
    "payment_plan_hash" "text" NOT NULL,
    "payment_plan_snapshot" "jsonb" NOT NULL,
    "provider_count" integer NOT NULL,
    "payment_unit_count" integer NOT NULL,
    "total_amount_cents" bigint NOT NULL,
    "currency" "text" NOT NULL,
    "confirmed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invalidated_at" timestamp with time zone,
    "invalidation_reason" "text",
    "consumed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "klyx_split_payment_confirmation_currency_13_26" CHECK (("char_length"("currency") = 3)),
    CONSTRAINT "klyx_split_payment_confirmation_hash_13_26" CHECK (("char_length"("payment_plan_hash") = 64)),
    CONSTRAINT "klyx_split_payment_confirmation_provider_count_13_26" CHECK (("provider_count" >= 2)),
    CONSTRAINT "klyx_split_payment_confirmation_total_13_26" CHECK (("total_amount_cents" >= 0)),
    CONSTRAINT "klyx_split_payment_confirmation_unit_count_13_26" CHECK (("payment_unit_count" >= 2))
);


ALTER TABLE "public"."split_booking_payment_confirmations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."split_booking_payment_refunds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "run_id" "uuid" NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "stripe_refund_id" "text" NOT NULL,
    "stripe_payment_intent_id" "text",
    "amount_cents" bigint NOT NULL,
    "currency" "text" NOT NULL,
    "status" "text" NOT NULL,
    "raw_status" "text",
    "failure_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "klyx_split_refund_amount_13_28" CHECK (("amount_cents" > 0)),
    CONSTRAINT "klyx_split_refund_currency_13_28" CHECK (("char_length"("currency") = 3)),
    CONSTRAINT "klyx_split_refund_status_13_28" CHECK (("status" = ANY (ARRAY['processing'::"text", 'succeeded'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."split_booking_payment_refunds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."split_booking_payment_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "client_profile_id" "uuid" NOT NULL,
    "payment_confirmation_id" "uuid" NOT NULL,
    "payment_plan_hash" "text" NOT NULL,
    "total_amount_cents" bigint NOT NULL,
    "currency" "text" NOT NULL,
    "provider_count" integer NOT NULL,
    "payment_unit_count" integer NOT NULL,
    "status" "text" DEFAULT 'preparing'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ready_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    CONSTRAINT "klyx_split_run_currency_13_27" CHECK (("char_length"("currency") = 3)),
    CONSTRAINT "klyx_split_run_hash_13_27" CHECK (("char_length"("payment_plan_hash") = 64)),
    CONSTRAINT "klyx_split_run_provider_count_13_27" CHECK (("provider_count" >= 2)),
    CONSTRAINT "klyx_split_run_status_13_28" CHECK (("status" = ANY (ARRAY['preparing'::"text", 'ready'::"text", 'partially_paid'::"text", 'paid'::"text", 'partially_refunded'::"text", 'refunded'::"text"]))),
    CONSTRAINT "klyx_split_run_total_13_27" CHECK (("total_amount_cents" >= 0)),
    CONSTRAINT "klyx_split_run_unit_count_13_27" CHECK (("payment_unit_count" >= 2))
);


ALTER TABLE "public"."split_booking_payment_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."split_booking_payment_units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "payment_confirmation_id" "uuid" NOT NULL,
    "client_profile_id" "uuid" NOT NULL,
    "provider_profile_id" "uuid" NOT NULL,
    "stripe_account_id" "text" NOT NULL,
    "amount_cents" bigint NOT NULL,
    "currency" "text" NOT NULL,
    "booking_ids" "jsonb" NOT NULL,
    "slot_ids" "jsonb" NOT NULL,
    "application_fee_amount" bigint NOT NULL,
    "provider_amount_cents" bigint NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempt_number" integer DEFAULT 0 NOT NULL,
    "attempt_token" "text",
    "stripe_checkout_session_id" "text",
    "checkout_url" "text",
    "stripe_payment_intent_id" "text",
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "checkout_created_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "refund_status" "text" DEFAULT 'none'::"text" NOT NULL,
    "refunded_amount_cents" bigint DEFAULT 0 NOT NULL,
    "stripe_refund_id" "text",
    "refund_failure_reason" "text",
    "refund_updated_at" timestamp with time zone,
    CONSTRAINT "klyx_split_unit_amount_13_27" CHECK (("amount_cents" >= 50)),
    CONSTRAINT "klyx_split_unit_booking_json_13_27" CHECK (("jsonb_typeof"("booking_ids") = 'array'::"text")),
    CONSTRAINT "klyx_split_unit_currency_13_27" CHECK (("char_length"("currency") = 3)),
    CONSTRAINT "klyx_split_unit_fee_13_27" CHECK ((("application_fee_amount" >= 0) AND ("provider_amount_cents" >= 0) AND (("application_fee_amount" + "provider_amount_cents") = "amount_cents"))),
    CONSTRAINT "klyx_split_unit_refund_status_13_28" CHECK (("refund_status" = ANY (ARRAY['none'::"text", 'processing'::"text", 'partially_refunded'::"text", 'refunded'::"text", 'failed'::"text"]))),
    CONSTRAINT "klyx_split_unit_refunded_amount_13_28" CHECK ((("refunded_amount_cents" >= 0) AND ("refunded_amount_cents" <= "amount_cents"))),
    CONSTRAINT "klyx_split_unit_slot_json_13_27" CHECK (("jsonb_typeof"("slot_ids") = 'array'::"text")),
    CONSTRAINT "klyx_split_unit_status_13_27" CHECK (("status" = ANY (ARRAY['pending'::"text", 'creating'::"text", 'checkout_open'::"text", 'paid'::"text", 'failed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."split_booking_payment_units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."split_booking_price_confirmations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "client_profile_id" "uuid" NOT NULL,
    "price_hash" "text" NOT NULL,
    "price_snapshot" "jsonb" NOT NULL,
    "item_count" integer NOT NULL,
    "total_amount_cents" bigint NOT NULL,
    "currency" "text" NOT NULL,
    "confirmed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invalidated_at" timestamp with time zone,
    "invalidation_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "klyx_split_price_count_13_23" CHECK (("item_count" >= 2)),
    CONSTRAINT "klyx_split_price_currency_13_23" CHECK (("char_length"("currency") = 3)),
    CONSTRAINT "klyx_split_price_hash_13_23" CHECK (("char_length"("price_hash") = 64)),
    CONSTRAINT "klyx_split_price_total_13_23" CHECK (("total_amount_cents" >= 0))
);


ALTER TABLE "public"."split_booking_price_confirmations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."split_booking_proof_consumptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "confirmation_id" "uuid" NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "market_request_id" "uuid" NOT NULL,
    "client_profile_id" "uuid" NOT NULL,
    "plan_hash" "text" NOT NULL,
    "consumed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "klyx_split_consumption_hash_13_20" CHECK (("char_length"("plan_hash") = 64))
);


ALTER TABLE "public"."split_booking_proof_consumptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "logo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "object_id" "text",
    "livemode" boolean DEFAULT false NOT NULL,
    "api_version" "text",
    "status" "text" DEFAULT 'processing'::"text" NOT NULL,
    "attempt_count" integer DEFAULT 1 NOT NULL,
    "last_error" "text",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stripe_webhook_events_attempt_count_check" CHECK (("attempt_count" >= 1)),
    CONSTRAINT "stripe_webhook_events_status_check" CHECK (("status" = ANY (ARRAY['processing'::"text", 'processed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."stripe_webhook_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."stripe_webhook_events" IS 'Journal serveur KLYX des événements Stripe pour idempotence et audit.';



COMMENT ON COLUMN "public"."stripe_webhook_events"."stripe_event_id" IS 'Identifiant Stripe evt_... unique, utilisé pour empêcher le double traitement.';



CREATE TABLE IF NOT EXISTS "public"."sumsub_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_hash" "text" NOT NULL,
    "event_type" "text",
    "applicant_id" "text",
    "external_user_id" "text",
    "review_status" "text",
    "review_answer" "text",
    "sandbox_mode" boolean,
    "processed" boolean DEFAULT false NOT NULL,
    "last_error" "text",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone
);


ALTER TABLE "public"."sumsub_webhook_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."sumsub_webhook_events" IS 'Journal serveur des webhooks Sumsub KLYX. Aucun acces direct client.';



CREATE TABLE IF NOT EXISTS "public"."user_memory_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_key" "text" NOT NULL,
    "event_value" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "confidence" numeric(4,3) DEFAULT 1 NOT NULL,
    "source" "text" DEFAULT 'user'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_memory_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "booking_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "href" "text",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deduplication_key" "text",
    "market_request_id" "uuid",
    CONSTRAINT "user_notifications_type_check" CHECK (("type" = ANY (ARRAY['booking_created'::"text", 'booking_accepted'::"text", 'booking_rejected'::"text", 'booking_cancelled'::"text", 'payment_required'::"text", 'payment_received'::"text", 'tracking_updated'::"text", 'review_required'::"text", 'message_received'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."user_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "default_city" "text",
    "default_budget" numeric(10,2),
    "preferred_service_slugs" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "preferred_provider_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "household_notes" "text",
    "scheduling_notes" "text",
    "ai_memory_enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "provider_enabled" boolean DEFAULT true NOT NULL,
    "custom_name" "text"
);


ALTER TABLE "public"."user_services" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_services"."custom_name" IS 'Nom personnalisé du métier affiché par le prestataire';



ALTER TABLE ONLY "public"."availability_slots"
    ADD CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."availability_slots"
    ADD CONSTRAINT "availability_unique_slot" UNIQUE ("user_service_id", "day_of_week", "start_time", "end_time");



ALTER TABLE ONLY "public"."booking_financial_ledger"
    ADD CONSTRAINT "booking_financial_ledger_entry_key_key" UNIQUE ("entry_key");



ALTER TABLE ONLY "public"."booking_financial_ledger"
    ADD CONSTRAINT "booking_financial_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_group_cancellation_events"
    ADD CONSTRAINT "booking_group_cancellation_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_groups"
    ADD CONSTRAINT "booking_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_status_events"
    ADD CONSTRAINT "booking_status_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_tracking_events"
    ADD CONSTRAINT "booking_tracking_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brain_conversations"
    ADD CONSTRAINT "brain_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brain_messages"
    ADD CONSTRAINT "brain_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_agent_plans"
    ADD CONSTRAINT "client_agent_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_memory_profiles"
    ADD CONSTRAINT "client_memory_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_memory_profiles"
    ADD CONSTRAINT "client_memory_profiles_profile_unique" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."dispute_events"
    ADD CONSTRAINT "dispute_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."disputes"
    ADD CONSTRAINT "disputes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_service_profile_id_key" UNIQUE ("user_id", "service_profile_id");



ALTER TABLE ONLY "public"."split_booking_payment_units"
    ADD CONSTRAINT "klyx_split_unit_provider_unique_13_27" UNIQUE ("run_id", "provider_profile_id");



ALTER TABLE ONLY "public"."market_request_provider_candidates"
    ADD CONSTRAINT "market_request_provider_candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."market_service_offers"
    ADD CONSTRAINT "market_service_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."market_service_offers"
    ADD CONSTRAINT "market_service_offers_request_id_provider_profile_id_key" UNIQUE ("request_id", "provider_profile_id");



ALTER TABLE ONLY "public"."market_service_request_slots"
    ADD CONSTRAINT "market_service_request_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."market_service_requests"
    ADD CONSTRAINT "market_service_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."market_split_plan_confirmations"
    ADD CONSTRAINT "market_split_plan_confirmations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."phone_contact_access_logs"
    ADD CONSTRAINT "phone_contact_access_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."phone_verification_limits"
    ADD CONSTRAINT "phone_verification_limits_pkey" PRIMARY KEY ("profile_id");



ALTER TABLE ONLY "public"."photo_service_requests"
    ADD CONSTRAINT "photo_service_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."photo_service_requests"
    ADD CONSTRAINT "photo_service_requests_storage_path_unique" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."profile_risk_assessments"
    ADD CONSTRAINT "profile_risk_assessments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_services"
    ADD CONSTRAINT "project_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_assistant_drafts"
    ADD CONSTRAINT "provider_assistant_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_documents"
    ADD CONSTRAINT "provider_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_documents"
    ADD CONSTRAINT "provider_documents_profile_type_unique" UNIQUE ("profile_id", "document_type");



ALTER TABLE ONLY "public"."provider_documents"
    ADD CONSTRAINT "provider_documents_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."provider_gallery"
    ADD CONSTRAINT "provider_gallery_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_gallery"
    ADD CONSTRAINT "provider_gallery_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."provider_profiles"
    ADD CONSTRAINT "provider_profiles_pkey" PRIMARY KEY ("profile_id");



ALTER TABLE ONLY "public"."provider_service_zones"
    ADD CONSTRAINT "provider_service_zones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_service_zones"
    ADD CONSTRAINT "provider_service_zones_unique" UNIQUE ("user_service_id", "country_code", "locality", "postal_code");



ALTER TABLE ONLY "public"."provider_skill_documents"
    ADD CONSTRAINT "provider_skill_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_skill_documents"
    ADD CONSTRAINT "provider_skill_documents_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."provider_skill_verifications"
    ADD CONSTRAINT "provider_skill_verifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_skill_verifications"
    ADD CONSTRAINT "provider_skill_verifications_profile_id_user_service_id_key" UNIQUE ("profile_id", "user_service_id");



ALTER TABLE ONLY "public"."provider_verification_documents"
    ADD CONSTRAINT "provider_verification_documents_path_unique" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."provider_verification_documents"
    ADD CONSTRAINT "provider_verification_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_verifications"
    ADD CONSTRAINT "provider_verifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_verifications"
    ADD CONSTRAINT "provider_verifications_profile_unique" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_booking_id_author_id_key" UNIQUE ("booking_id", "author_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_alerts"
    ADD CONSTRAINT "security_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_profiles"
    ADD CONSTRAINT "service_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_proposals"
    ADD CONSTRAINT "service_proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_quotes"
    ADD CONSTRAINT "service_quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."skill_qualification_rules"
    ADD CONSTRAINT "skill_qualification_rules_country_code_service_slug_key" UNIQUE ("country_code", "service_slug");



ALTER TABLE ONLY "public"."skill_qualification_rules"
    ADD CONSTRAINT "skill_qualification_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."split_booking_batch_items"
    ADD CONSTRAINT "split_booking_batch_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."split_booking_batches"
    ADD CONSTRAINT "split_booking_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."split_booking_payment_confirmations"
    ADD CONSTRAINT "split_booking_payment_confirmations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."split_booking_payment_refunds"
    ADD CONSTRAINT "split_booking_payment_refunds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."split_booking_payment_refunds"
    ADD CONSTRAINT "split_booking_payment_refunds_stripe_refund_id_key" UNIQUE ("stripe_refund_id");



ALTER TABLE ONLY "public"."split_booking_payment_runs"
    ADD CONSTRAINT "split_booking_payment_runs_batch_id_key" UNIQUE ("batch_id");



ALTER TABLE ONLY "public"."split_booking_payment_runs"
    ADD CONSTRAINT "split_booking_payment_runs_payment_confirmation_id_key" UNIQUE ("payment_confirmation_id");



ALTER TABLE ONLY "public"."split_booking_payment_runs"
    ADD CONSTRAINT "split_booking_payment_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."split_booking_payment_units"
    ADD CONSTRAINT "split_booking_payment_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."split_booking_price_confirmations"
    ADD CONSTRAINT "split_booking_price_confirmations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."split_booking_proof_consumptions"
    ADD CONSTRAINT "split_booking_proof_consumptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_webhook_events"
    ADD CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_webhook_events"
    ADD CONSTRAINT "stripe_webhook_events_stripe_event_id_key" UNIQUE ("stripe_event_id");



ALTER TABLE ONLY "public"."sumsub_webhook_events"
    ADD CONSTRAINT "sumsub_webhook_events_event_hash_key" UNIQUE ("event_hash");



ALTER TABLE ONLY "public"."sumsub_webhook_events"
    ADD CONSTRAINT "sumsub_webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_memory_events"
    ADD CONSTRAINT "user_memory_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_services"
    ADD CONSTRAINT "user_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_services"
    ADD CONSTRAINT "user_services_user_id_service_id_key" UNIQUE ("user_id", "service_id");



CREATE INDEX "booking_financial_ledger_booking_idx" ON "public"."booking_financial_ledger" USING "btree" ("booking_id", "created_at" DESC);



CREATE INDEX "booking_financial_ledger_status_idx" ON "public"."booking_financial_ledger" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "booking_group_cancellation_events_group_idx" ON "public"."booking_group_cancellation_events" USING "btree" ("booking_group_id", "created_at" DESC);



CREATE UNIQUE INDEX "booking_groups_active_request_uidx" ON "public"."booking_groups" USING "btree" ("market_request_id") WHERE ("status" = ANY (ARRAY['pending_provider'::"text", 'accepted'::"text"]));



CREATE INDEX "booking_groups_cancellation_status_idx" ON "public"."booking_groups" USING "btree" ("cancellation_request_status");



CREATE INDEX "booking_groups_checkout_session_idx" ON "public"."booking_groups" USING "btree" ("stripe_checkout_session_id");



CREATE INDEX "booking_groups_client_idx" ON "public"."booking_groups" USING "btree" ("client_profile_id", "created_at" DESC);



CREATE INDEX "booking_groups_payment_intent_idx" ON "public"."booking_groups" USING "btree" ("stripe_payment_intent_id");



CREATE INDEX "booking_groups_provider_idx" ON "public"."booking_groups" USING "btree" ("provider_profile_id", "created_at" DESC);



CREATE INDEX "booking_groups_stripe_refund_idx" ON "public"."booking_groups" USING "btree" ("stripe_refund_id");



CREATE INDEX "booking_status_events_booking_created_idx" ON "public"."booking_status_events" USING "btree" ("booking_id", "created_at");



CREATE INDEX "booking_tracking_events_booking_id_idx" ON "public"."booking_tracking_events" USING "btree" ("booking_id", "created_at" DESC);



CREATE INDEX "bookings_group_idx" ON "public"."bookings" USING "btree" ("booking_group_id");



CREATE UNIQUE INDEX "bookings_group_position_uidx" ON "public"."bookings" USING "btree" ("booking_group_id", "group_position") WHERE ("booking_group_id" IS NOT NULL);



CREATE INDEX "bookings_parent_schedule_idx" ON "public"."bookings" USING "btree" ("parent_id", "booking_date", "start_time", "end_time", "status");



CREATE INDEX "bookings_provider_finished_idx" ON "public"."bookings" USING "btree" ("provider_finished_at") WHERE (("provider_finished_at" IS NOT NULL) AND ("client_confirmed_at" IS NULL));



CREATE INDEX "bookings_provider_id_idx" ON "public"."bookings" USING "btree" ("provider_id");



CREATE INDEX "bookings_provider_schedule_idx" ON "public"."bookings" USING "btree" ("provider_id", "booking_date", "start_time", "end_time", "status");



CREATE INDEX "bookings_quote_id_idx" ON "public"."bookings" USING "btree" ("quote_id");



CREATE UNIQUE INDEX "bookings_quote_id_unique" ON "public"."bookings" USING "btree" ("quote_id") WHERE ("quote_id" IS NOT NULL);



CREATE INDEX "bookings_refund_status_idx" ON "public"."bookings" USING "btree" ("refund_status", "refunded_at" DESC);



CREATE INDEX "bookings_service_id_idx" ON "public"."bookings" USING "btree" ("service_id");



CREATE INDEX "bookings_stripe_checkout_session_idx" ON "public"."bookings" USING "btree" ("stripe_checkout_session_id");



CREATE UNIQUE INDEX "bookings_stripe_checkout_session_unique" ON "public"."bookings" USING "btree" ("stripe_checkout_session_id") WHERE ("stripe_checkout_session_id" IS NOT NULL);



CREATE INDEX "bookings_stripe_payment_intent_idx" ON "public"."bookings" USING "btree" ("stripe_payment_intent_id");



CREATE UNIQUE INDEX "bookings_stripe_payment_intent_unique" ON "public"."bookings" USING "btree" ("stripe_payment_intent_id") WHERE ("stripe_payment_intent_id" IS NOT NULL);



CREATE UNIQUE INDEX "bookings_stripe_refund_id_unique" ON "public"."bookings" USING "btree" ("stripe_refund_id") WHERE ("stripe_refund_id" IS NOT NULL);



CREATE INDEX "bookings_user_service_id_idx" ON "public"."bookings" USING "btree" ("user_service_id");



CREATE INDEX "client_agent_plans_profile_idx" ON "public"."client_agent_plans" USING "btree" ("profile_id", "created_at" DESC);



CREATE INDEX "dispute_events_dispute_idx" ON "public"."dispute_events" USING "btree" ("dispute_id", "created_at");



CREATE INDEX "disputes_admin_status_idx" ON "public"."disputes" USING "btree" ("status", "priority", "created_at");



CREATE INDEX "disputes_assigned_admin_idx" ON "public"."disputes" USING "btree" ("assigned_admin_user_id", "status") WHERE ("assigned_admin_user_id" IS NOT NULL);



CREATE INDEX "disputes_booking_idx" ON "public"."disputes" USING "btree" ("booking_id", "created_at" DESC);



CREATE UNIQUE INDEX "disputes_one_active_per_booking_actor" ON "public"."disputes" USING "btree" ("booking_id", "opened_by") WHERE ("status" = ANY (ARRAY['open'::"text", 'under_review'::"text", 'waiting_user'::"text"]));



CREATE INDEX "disputes_opened_by_idx" ON "public"."disputes" USING "btree" ("opened_by", "created_at" DESC);



CREATE UNIQUE INDEX "klyx_split_booking_booking_unique_13_19" ON "public"."split_booking_batch_items" USING "btree" ("booking_id");



CREATE UNIQUE INDEX "klyx_split_booking_confirmation_unique_13_19" ON "public"."split_booking_batches" USING "btree" ("confirmation_id");



CREATE INDEX "klyx_split_booking_request_idx_13_19" ON "public"."split_booking_batches" USING "btree" ("market_request_id", "created_at" DESC);



CREATE UNIQUE INDEX "klyx_split_booking_slot_unique_13_19" ON "public"."split_booking_batch_items" USING "btree" ("batch_id", "slot_id");



CREATE UNIQUE INDEX "klyx_split_consumption_batch_13_20" ON "public"."split_booking_proof_consumptions" USING "btree" ("batch_id");



CREATE UNIQUE INDEX "klyx_split_consumption_confirmation_13_20" ON "public"."split_booking_proof_consumptions" USING "btree" ("confirmation_id");



CREATE UNIQUE INDEX "klyx_split_payment_confirmation_active_13_26" ON "public"."split_booking_payment_confirmations" USING "btree" ("batch_id") WHERE (("invalidated_at" IS NULL) AND ("consumed_at" IS NULL));



CREATE INDEX "klyx_split_payment_confirmation_batch_13_26" ON "public"."split_booking_payment_confirmations" USING "btree" ("batch_id", "confirmed_at" DESC);



CREATE UNIQUE INDEX "klyx_split_plan_confirmation_one_active_13_19i" ON "public"."market_split_plan_confirmations" USING "btree" ("market_request_id") WHERE ("invalidated_at" IS NULL);



CREATE INDEX "klyx_split_plan_confirmation_request_13_19i" ON "public"."market_split_plan_confirmations" USING "btree" ("market_request_id", "confirmed_at" DESC);



CREATE INDEX "klyx_split_price_batch_history_13_23" ON "public"."split_booking_price_confirmations" USING "btree" ("batch_id", "confirmed_at" DESC);



CREATE UNIQUE INDEX "klyx_split_price_one_active_13_23" ON "public"."split_booking_price_confirmations" USING "btree" ("batch_id") WHERE ("invalidated_at" IS NULL);



CREATE INDEX "klyx_split_refund_run_13_28" ON "public"."split_booking_payment_refunds" USING "btree" ("run_id", "status");



CREATE INDEX "klyx_split_refund_unit_13_28" ON "public"."split_booking_payment_refunds" USING "btree" ("unit_id", "created_at");



CREATE INDEX "klyx_split_unit_batch_13_27" ON "public"."split_booking_payment_units" USING "btree" ("batch_id", "status");



CREATE UNIQUE INDEX "klyx_split_unit_session_unique_13_27" ON "public"."split_booking_payment_units" USING "btree" ("stripe_checkout_session_id") WHERE ("stripe_checkout_session_id" IS NOT NULL);



CREATE INDEX "market_offers_provider_idx" ON "public"."market_service_offers" USING "btree" ("provider_profile_id", "created_at" DESC);



CREATE INDEX "market_offers_request_idx" ON "public"."market_service_offers" USING "btree" ("request_id", "created_at" DESC);



CREATE INDEX "market_request_provider_candidates_rank_idx" ON "public"."market_request_provider_candidates" USING "btree" ("market_request_id", "full_coverage" DESC, "coverage_count" DESC);



CREATE UNIQUE INDEX "market_request_provider_candidates_uidx" ON "public"."market_request_provider_candidates" USING "btree" ("market_request_id", "provider_profile_id");



CREATE INDEX "market_requests_client_idx" ON "public"."market_service_requests" USING "btree" ("client_profile_id", "created_at" DESC);



CREATE INDEX "market_requests_service_status_idx" ON "public"."market_service_requests" USING "btree" ("service_id", "status", "created_at" DESC);



CREATE INDEX "market_service_request_slots_date_idx" ON "public"."market_service_request_slots" USING "btree" ("requested_date");



CREATE UNIQUE INDEX "market_service_request_slots_request_position_uidx" ON "public"."market_service_request_slots" USING "btree" ("market_request_id", "position");



CREATE INDEX "phone_contact_logs_booking_idx" ON "public"."phone_contact_access_logs" USING "btree" ("booking_id", "created_at" DESC);



CREATE INDEX "phone_contact_logs_viewer_idx" ON "public"."phone_contact_access_logs" USING "btree" ("viewer_profile_id", "created_at" DESC);



CREATE INDEX "phone_verification_limits_locked_until_idx" ON "public"."phone_verification_limits" USING "btree" ("locked_until");



CREATE INDEX "photo_service_requests_profile_idx" ON "public"."photo_service_requests" USING "btree" ("profile_id", "created_at" DESC);



CREATE INDEX "profile_risk_assessments_level_idx" ON "public"."profile_risk_assessments" USING "btree" ("risk_level", "assessed_at" DESC);



CREATE UNIQUE INDEX "profile_risk_assessments_profile_unique" ON "public"."profile_risk_assessments" USING "btree" ("profile_id");



CREATE INDEX "profiles_owner_user_id_idx" ON "public"."profiles" USING "btree" ("owner_user_id");



CREATE UNIQUE INDEX "profiles_stripe_account_id_key" ON "public"."profiles" USING "btree" ("stripe_account_id") WHERE ("stripe_account_id" IS NOT NULL);



CREATE UNIQUE INDEX "profiles_stripe_account_id_unique" ON "public"."profiles" USING "btree" ("stripe_account_id") WHERE ("stripe_account_id" IS NOT NULL);



CREATE INDEX "project_services_project_id_idx" ON "public"."project_services" USING "btree" ("project_id");



CREATE INDEX "projects_created_at_idx" ON "public"."projects" USING "btree" ("created_at" DESC);



CREATE INDEX "projects_user_id_idx" ON "public"."projects" USING "btree" ("user_id");



CREATE INDEX "provider_assistant_drafts_profile_idx" ON "public"."provider_assistant_drafts" USING "btree" ("profile_id", "created_at" DESC);



CREATE INDEX "provider_documents_profile_idx" ON "public"."provider_documents" USING "btree" ("profile_id", "created_at" DESC);



CREATE INDEX "provider_gallery_profile_position_idx" ON "public"."provider_gallery" USING "btree" ("profile_id", "position", "created_at");



CREATE UNIQUE INDEX "provider_service_zones_one_primary" ON "public"."provider_service_zones" USING "btree" ("user_service_id") WHERE (("is_primary" = true) AND ("is_active" = true));



CREATE INDEX "provider_service_zones_profile_idx" ON "public"."provider_service_zones" USING "btree" ("profile_id", "is_active");



CREATE INDEX "provider_service_zones_service_idx" ON "public"."provider_service_zones" USING "btree" ("user_service_id", "is_active");



CREATE INDEX "provider_skill_documents_verification_idx" ON "public"."provider_skill_documents" USING "btree" ("verification_id", "uploaded_at" DESC);



CREATE INDEX "provider_skill_verifications_profile_idx" ON "public"."provider_skill_verifications" USING "btree" ("profile_id", "updated_at" DESC);



CREATE INDEX "provider_skill_verifications_service_idx" ON "public"."provider_skill_verifications" USING "btree" ("user_service_id", "status");



CREATE INDEX "provider_verification_documents_profile_idx" ON "public"."provider_verification_documents" USING "btree" ("profile_id", "uploaded_at" DESC);



CREATE UNIQUE INDEX "provider_verifications_external_applicant_idx" ON "public"."provider_verifications" USING "btree" ("external_applicant_id") WHERE ("external_applicant_id" IS NOT NULL);



CREATE UNIQUE INDEX "reviews_booking_group_author_uidx" ON "public"."reviews" USING "btree" ("booking_group_id", "author_id") WHERE ("booking_group_id" IS NOT NULL);



CREATE INDEX "reviews_booking_group_idx" ON "public"."reviews" USING "btree" ("booking_group_id");



CREATE UNIQUE INDEX "security_alerts_deduplication_unique" ON "public"."security_alerts" USING "btree" ("deduplication_key") WHERE ("deduplication_key" IS NOT NULL);



CREATE INDEX "security_alerts_profile_idx" ON "public"."security_alerts" USING "btree" ("profile_id", "created_at" DESC);



CREATE INDEX "service_profiles_klyx_score_idx" ON "public"."service_profiles" USING "btree" ("klyx_score" DESC);



CREATE INDEX "service_proposals_profile_id_idx" ON "public"."service_proposals" USING "btree" ("profile_id");



CREATE INDEX "service_proposals_status_idx" ON "public"."service_proposals" USING "btree" ("status");



CREATE INDEX "service_quotes_client_idx" ON "public"."service_quotes" USING "btree" ("client_profile_id", "created_at" DESC);



CREATE INDEX "service_quotes_market_request_id_idx" ON "public"."service_quotes" USING "btree" ("market_request_id");



CREATE UNIQUE INDEX "service_quotes_market_request_id_unique" ON "public"."service_quotes" USING "btree" ("market_request_id") WHERE ("market_request_id" IS NOT NULL);



CREATE INDEX "service_quotes_provider_idx" ON "public"."service_quotes" USING "btree" ("provider_profile_id", "created_at" DESC);



CREATE INDEX "service_quotes_status_idx" ON "public"."service_quotes" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "skill_qualification_rules_lookup_idx" ON "public"."skill_qualification_rules" USING "btree" ("country_code", "service_slug", "enabled");



CREATE INDEX "stripe_webhook_events_status_idx" ON "public"."stripe_webhook_events" USING "btree" ("status", "updated_at" DESC);



CREATE INDEX "stripe_webhook_events_type_idx" ON "public"."stripe_webhook_events" USING "btree" ("event_type", "received_at" DESC);



CREATE INDEX "sumsub_webhook_events_applicant_idx" ON "public"."sumsub_webhook_events" USING "btree" ("applicant_id", "received_at" DESC);



CREATE INDEX "sumsub_webhook_events_external_user_idx" ON "public"."sumsub_webhook_events" USING "btree" ("external_user_id", "received_at" DESC);



CREATE INDEX "user_memory_events_event_key_idx" ON "public"."user_memory_events" USING "btree" ("event_key");



CREATE INDEX "user_memory_events_user_id_idx" ON "public"."user_memory_events" USING "btree" ("user_id");



CREATE UNIQUE INDEX "user_notifications_deduplication_key_unique" ON "public"."user_notifications" USING "btree" ("deduplication_key");



CREATE INDEX "user_notifications_market_request_id_idx" ON "public"."user_notifications" USING "btree" ("market_request_id");



CREATE INDEX "user_notifications_unread_idx" ON "public"."user_notifications" USING "btree" ("user_id", "read_at") WHERE ("read_at" IS NULL);



CREATE INDEX "user_notifications_user_id_idx" ON "public"."user_notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "bookings_notify_insert" AFTER INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."notify_new_booking"();



CREATE OR REPLACE TRIGGER "bookings_notify_status" AFTER UPDATE OF "status" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."notify_booking_status"();



CREATE OR REPLACE TRIGGER "bookings_validate_availability" BEFORE INSERT OR UPDATE OF "booking_date", "start_time", "end_time", "babysitter_id" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."validate_booking_availability"();



CREATE OR REPLACE TRIGGER "klyx_block_split_payment_reconfirmation_13_27" BEFORE INSERT ON "public"."split_booking_payment_confirmations" FOR EACH ROW EXECUTE FUNCTION "public"."klyx_block_split_payment_reconfirmation_13_27"();



CREATE OR REPLACE TRIGGER "klyx_booking_group_live_coverage_12_96" BEFORE INSERT ON "public"."booking_groups" FOR EACH ROW EXECUTE FUNCTION "public"."klyx_enforce_group_live_coverage_12_96"();



COMMENT ON TRIGGER "klyx_booking_group_live_coverage_12_96" ON "public"."booking_groups" IS 'KLYX 12.96 - empeche la creation d un groupe si le prestataire ne couvre plus tous les creneaux.';



CREATE OR REPLACE TRIGGER "klyx_consume_split_booking_proof_13_20" AFTER UPDATE OF "status" ON "public"."split_booking_batches" FOR EACH ROW EXECUTE FUNCTION "public"."klyx_consume_split_booking_proof_13_20"();



CREATE OR REPLACE TRIGGER "klyx_group_provider_accept_live_13_06" BEFORE UPDATE OF "status" ON "public"."booking_groups" FOR EACH ROW EXECUTE FUNCTION "public"."klyx_enforce_group_provider_accept_live_13_06"();



CREATE OR REPLACE TRIGGER "klyx_multi_slot_offer_atomic_13_09" BEFORE INSERT OR UPDATE ON "public"."market_service_offers" FOR EACH ROW EXECUTE FUNCTION "public"."klyx_enforce_multi_slot_offer_live_13_09"();



CREATE OR REPLACE TRIGGER "klyx_prepare_profile_before_insert" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."klyx_prepare_profile"();



CREATE OR REPLACE TRIGGER "klyx_prevent_provider_booking_overlap" BEFORE INSERT OR UPDATE OF "provider_id", "babysitter_id", "booking_date", "start_time", "end_time", "status" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."klyx_prevent_provider_booking_overlap"();



CREATE OR REPLACE TRIGGER "klyx_protect_paid_booking" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."klyx_protect_paid_booking"();



CREATE OR REPLACE TRIGGER "klyx_split_batch_integrity_13_20" BEFORE UPDATE ON "public"."split_booking_batches" FOR EACH ROW EXECUTE FUNCTION "public"."klyx_split_batch_integrity_13_20"();



CREATE OR REPLACE TRIGGER "klyx_split_batch_item_count_delete_13_20" AFTER DELETE ON "public"."split_booking_batch_items" FOR EACH ROW EXECUTE FUNCTION "public"."klyx_split_batch_item_count_13_20"();



CREATE OR REPLACE TRIGGER "klyx_split_batch_item_count_insert_13_20" AFTER INSERT ON "public"."split_booking_batch_items" FOR EACH ROW EXECUTE FUNCTION "public"."klyx_split_batch_item_count_13_20"();



CREATE OR REPLACE TRIGGER "messages_notify_insert" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."notify_new_message"();



CREATE OR REPLACE TRIGGER "reviews_refresh_rating" AFTER INSERT OR DELETE OR UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."refresh_service_profile_rating"();



ALTER TABLE ONLY "public"."availability_slots"
    ADD CONSTRAINT "availability_slots_user_service_id_fkey" FOREIGN KEY ("user_service_id") REFERENCES "public"."user_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_group_cancellation_events"
    ADD CONSTRAINT "booking_group_cancellation_events_actor_profile_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_group_cancellation_events"
    ADD CONSTRAINT "booking_group_cancellation_events_booking_group_id_fkey" FOREIGN KEY ("booking_group_id") REFERENCES "public"."booking_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_groups"
    ADD CONSTRAINT "booking_groups_cancellation_requested_by_fkey" FOREIGN KEY ("cancellation_requested_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_groups"
    ADD CONSTRAINT "booking_groups_cancellation_resolved_by_fkey" FOREIGN KEY ("cancellation_resolved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_groups"
    ADD CONSTRAINT "booking_groups_client_profile_id_fkey" FOREIGN KEY ("client_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_groups"
    ADD CONSTRAINT "booking_groups_market_request_id_fkey" FOREIGN KEY ("market_request_id") REFERENCES "public"."market_service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_groups"
    ADD CONSTRAINT "booking_groups_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."market_service_offers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."booking_groups"
    ADD CONSTRAINT "booking_groups_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_groups"
    ADD CONSTRAINT "booking_groups_user_service_id_fkey" FOREIGN KEY ("user_service_id") REFERENCES "public"."user_services"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."booking_status_events"
    ADD CONSTRAINT "booking_status_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_status_events"
    ADD CONSTRAINT "booking_status_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_tracking_events"
    ADD CONSTRAINT "booking_tracking_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_tracking_events"
    ADD CONSTRAINT "booking_tracking_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_babysitter_id_fkey" FOREIGN KEY ("babysitter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_booking_group_id_fkey" FOREIGN KEY ("booking_group_id") REFERENCES "public"."booking_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."service_quotes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_refund_requested_by_fkey" FOREIGN KEY ("refund_requested_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_user_service_id_fkey" FOREIGN KEY ("user_service_id") REFERENCES "public"."user_services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."brain_conversations"
    ADD CONSTRAINT "brain_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brain_messages"
    ADD CONSTRAINT "brain_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."brain_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_agent_plans"
    ADD CONSTRAINT "client_agent_plans_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_memory_profiles"
    ADD CONSTRAINT "client_memory_profiles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dispute_events"
    ADD CONSTRAINT "dispute_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dispute_events"
    ADD CONSTRAINT "dispute_events_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."disputes"
    ADD CONSTRAINT "disputes_against_profile_id_fkey" FOREIGN KEY ("against_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."disputes"
    ADD CONSTRAINT "disputes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."disputes"
    ADD CONSTRAINT "disputes_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_service_profile_id_fkey" FOREIGN KEY ("service_profile_id") REFERENCES "public"."service_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."market_request_provider_candidates"
    ADD CONSTRAINT "market_request_provider_candidates_market_request_id_fkey" FOREIGN KEY ("market_request_id") REFERENCES "public"."market_service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."market_request_provider_candidates"
    ADD CONSTRAINT "market_request_provider_candidates_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."market_service_offers"
    ADD CONSTRAINT "market_service_offers_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."market_service_offers"
    ADD CONSTRAINT "market_service_offers_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."market_service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."market_service_offers"
    ADD CONSTRAINT "market_service_offers_user_service_id_fkey" FOREIGN KEY ("user_service_id") REFERENCES "public"."user_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."market_service_request_slots"
    ADD CONSTRAINT "market_service_request_slots_market_request_id_fkey" FOREIGN KEY ("market_request_id") REFERENCES "public"."market_service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."market_service_requests"
    ADD CONSTRAINT "market_service_requests_accepted_offer_id_fkey" FOREIGN KEY ("accepted_offer_id") REFERENCES "public"."market_service_offers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."market_service_requests"
    ADD CONSTRAINT "market_service_requests_client_profile_id_fkey" FOREIGN KEY ("client_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."market_service_requests"
    ADD CONSTRAINT "market_service_requests_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."market_split_plan_confirmations"
    ADD CONSTRAINT "market_split_plan_confirmations_client_profile_id_fkey" FOREIGN KEY ("client_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."market_split_plan_confirmations"
    ADD CONSTRAINT "market_split_plan_confirmations_market_request_id_fkey" FOREIGN KEY ("market_request_id") REFERENCES "public"."market_service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."phone_contact_access_logs"
    ADD CONSTRAINT "phone_contact_access_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."phone_contact_access_logs"
    ADD CONSTRAINT "phone_contact_access_logs_contact_profile_id_fkey" FOREIGN KEY ("contact_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."phone_contact_access_logs"
    ADD CONSTRAINT "phone_contact_access_logs_viewer_profile_id_fkey" FOREIGN KEY ("viewer_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."phone_verification_limits"
    ADD CONSTRAINT "phone_verification_limits_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."photo_service_requests"
    ADD CONSTRAINT "photo_service_requests_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_risk_assessments"
    ADD CONSTRAINT "profile_risk_assessments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_services"
    ADD CONSTRAINT "project_services_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_assistant_drafts"
    ADD CONSTRAINT "provider_assistant_drafts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_documents"
    ADD CONSTRAINT "provider_documents_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_gallery"
    ADD CONSTRAINT "provider_gallery_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_profiles"
    ADD CONSTRAINT "provider_profiles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_service_zones"
    ADD CONSTRAINT "provider_service_zones_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_service_zones"
    ADD CONSTRAINT "provider_service_zones_user_service_id_fkey" FOREIGN KEY ("user_service_id") REFERENCES "public"."user_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_skill_documents"
    ADD CONSTRAINT "provider_skill_documents_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "public"."provider_skill_verifications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_verification_documents"
    ADD CONSTRAINT "provider_verification_documents_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_verifications"
    ADD CONSTRAINT "provider_verifications_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_booking_group_id_fkey" FOREIGN KEY ("booking_group_id") REFERENCES "public"."booking_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_alerts"
    ADD CONSTRAINT "security_alerts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_profiles"
    ADD CONSTRAINT "service_profiles_user_service_id_fkey" FOREIGN KEY ("user_service_id") REFERENCES "public"."user_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_proposals"
    ADD CONSTRAINT "service_proposals_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_quotes"
    ADD CONSTRAINT "service_quotes_client_profile_id_fkey" FOREIGN KEY ("client_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_quotes"
    ADD CONSTRAINT "service_quotes_market_request_id_fkey" FOREIGN KEY ("market_request_id") REFERENCES "public"."market_service_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_quotes"
    ADD CONSTRAINT "service_quotes_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_quotes"
    ADD CONSTRAINT "service_quotes_user_service_id_fkey" FOREIGN KEY ("user_service_id") REFERENCES "public"."user_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_booking_batch_items"
    ADD CONSTRAINT "split_booking_batch_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."split_booking_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_booking_batch_items"
    ADD CONSTRAINT "split_booking_batch_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_booking_batch_items"
    ADD CONSTRAINT "split_booking_batch_items_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."split_booking_batch_items"
    ADD CONSTRAINT "split_booking_batch_items_user_service_id_fkey" FOREIGN KEY ("user_service_id") REFERENCES "public"."user_services"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."split_booking_batches"
    ADD CONSTRAINT "split_booking_batches_client_profile_id_fkey" FOREIGN KEY ("client_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_booking_batches"
    ADD CONSTRAINT "split_booking_batches_confirmation_id_fkey" FOREIGN KEY ("confirmation_id") REFERENCES "public"."market_split_plan_confirmations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."split_booking_batches"
    ADD CONSTRAINT "split_booking_batches_market_request_id_fkey" FOREIGN KEY ("market_request_id") REFERENCES "public"."market_service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_booking_payment_confirmations"
    ADD CONSTRAINT "split_booking_payment_confirmations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."split_booking_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_booking_payment_confirmations"
    ADD CONSTRAINT "split_booking_payment_confirmations_client_profile_id_fkey" FOREIGN KEY ("client_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_booking_payment_confirmations"
    ADD CONSTRAINT "split_booking_payment_confirmations_price_confirmation_id_fkey" FOREIGN KEY ("price_confirmation_id") REFERENCES "public"."split_booking_price_confirmations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."split_booking_payment_refunds"
    ADD CONSTRAINT "split_booking_payment_refunds_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."split_booking_batches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."split_booking_payment_refunds"
    ADD CONSTRAINT "split_booking_payment_refunds_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."split_booking_payment_runs"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."split_booking_payment_refunds"
    ADD CONSTRAINT "split_booking_payment_refunds_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."split_booking_payment_units"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."split_booking_payment_runs"
    ADD CONSTRAINT "split_booking_payment_runs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."split_booking_batches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."split_booking_payment_runs"
    ADD CONSTRAINT "split_booking_payment_runs_client_profile_id_fkey" FOREIGN KEY ("client_profile_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."split_booking_payment_runs"
    ADD CONSTRAINT "split_booking_payment_runs_payment_confirmation_id_fkey" FOREIGN KEY ("payment_confirmation_id") REFERENCES "public"."split_booking_payment_confirmations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."split_booking_payment_units"
    ADD CONSTRAINT "split_booking_payment_units_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."split_booking_batches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."split_booking_payment_units"
    ADD CONSTRAINT "split_booking_payment_units_client_profile_id_fkey" FOREIGN KEY ("client_profile_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."split_booking_payment_units"
    ADD CONSTRAINT "split_booking_payment_units_payment_confirmation_id_fkey" FOREIGN KEY ("payment_confirmation_id") REFERENCES "public"."split_booking_payment_confirmations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."split_booking_payment_units"
    ADD CONSTRAINT "split_booking_payment_units_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."split_booking_payment_units"
    ADD CONSTRAINT "split_booking_payment_units_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."split_booking_payment_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_booking_price_confirmations"
    ADD CONSTRAINT "split_booking_price_confirmations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."split_booking_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_booking_price_confirmations"
    ADD CONSTRAINT "split_booking_price_confirmations_client_profile_id_fkey" FOREIGN KEY ("client_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_booking_proof_consumptions"
    ADD CONSTRAINT "split_booking_proof_consumptions_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."split_booking_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_booking_proof_consumptions"
    ADD CONSTRAINT "split_booking_proof_consumptions_client_profile_id_fkey" FOREIGN KEY ("client_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_booking_proof_consumptions"
    ADD CONSTRAINT "split_booking_proof_consumptions_confirmation_id_fkey" FOREIGN KEY ("confirmation_id") REFERENCES "public"."market_split_plan_confirmations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."split_booking_proof_consumptions"
    ADD CONSTRAINT "split_booking_proof_consumptions_market_request_id_fkey" FOREIGN KEY ("market_request_id") REFERENCES "public"."market_service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_memory_events"
    ADD CONSTRAINT "user_memory_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_market_request_id_fkey" FOREIGN KEY ("market_request_id") REFERENCES "public"."market_service_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_services"
    ADD CONSTRAINT "user_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_services"
    ADD CONSTRAINT "user_services_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Clients read offers on own requests" ON "public"."market_service_offers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."market_service_requests" "request"
     JOIN "public"."profiles" "profile" ON (("profile"."id" = "request"."client_profile_id")))
  WHERE (("request"."id" = "market_service_offers"."request_id") AND ("profile"."owner_user_id" = "auth"."uid"()) AND ("profile"."account_type" = 'client'::"text")))));



CREATE POLICY "Clients read own agent plans" ON "public"."client_agent_plans" FOR SELECT TO "authenticated" USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."owner_user_id" = "auth"."uid"()) AND ("profiles"."account_type" = 'client'::"text")))));



CREATE POLICY "Clients read own market requests" ON "public"."market_service_requests" FOR SELECT TO "authenticated" USING (("client_profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."owner_user_id" = "auth"."uid"()) AND ("profiles"."account_type" = 'client'::"text")))));



CREATE POLICY "Clients read own memory profile" ON "public"."client_memory_profiles" FOR SELECT TO "authenticated" USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."owner_user_id" = "auth"."uid"()) AND ("profiles"."account_type" = 'client'::"text")))));



CREATE POLICY "Clients read own photo requests" ON "public"."photo_service_requests" FOR SELECT TO "authenticated" USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."owner_user_id" = "auth"."uid"()) AND ("profiles"."account_type" = 'client'::"text")))));



CREATE POLICY "Clients read own quotes" ON "public"."service_quotes" FOR SELECT TO "authenticated" USING (("client_profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."owner_user_id" = "auth"."uid"()) AND ("profiles"."account_type" = 'client'::"text")))));



CREATE POLICY "Participants read dispute events" ON "public"."dispute_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."disputes" "d"
  WHERE (("d"."id" = "dispute_events"."dispute_id") AND (("d"."opened_by" IN ( SELECT "profiles"."id"
           FROM "public"."profiles"
          WHERE ("profiles"."owner_user_id" = "auth"."uid"()))) OR ("d"."against_profile_id" IN ( SELECT "profiles"."id"
           FROM "public"."profiles"
          WHERE ("profiles"."owner_user_id" = "auth"."uid"()))))))));



CREATE POLICY "Participants read own disputes" ON "public"."disputes" FOR SELECT TO "authenticated" USING ((("opened_by" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."owner_user_id" = "auth"."uid"()))) OR ("against_profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Profiles read own risk assessment" ON "public"."profile_risk_assessments" FOR SELECT TO "authenticated" USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Profiles read own security alerts" ON "public"."security_alerts" FOR SELECT TO "authenticated" USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Providers can create own service proposals" ON "public"."service_proposals" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "service_proposals"."profile_id") AND ("profiles"."owner_user_id" = "auth"."uid"()) AND ("profiles"."account_type" = 'provider'::"text")))));



CREATE POLICY "Providers can read own service proposals" ON "public"."service_proposals" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "service_proposals"."profile_id") AND ("profiles"."owner_user_id" = "auth"."uid"()) AND ("profiles"."account_type" = 'provider'::"text")))));



CREATE POLICY "Providers read open market requests" ON "public"."market_service_requests" FOR SELECT TO "authenticated" USING ((("status" = 'open'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."owner_user_id" = "auth"."uid"()) AND ("profiles"."account_type" = 'provider'::"text"))))));



CREATE POLICY "Providers read own assistant drafts" ON "public"."provider_assistant_drafts" FOR SELECT TO "authenticated" USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."owner_user_id" = "auth"."uid"()) AND ("profiles"."account_type" = 'provider'::"text")))));



CREATE POLICY "Providers read own market offers" ON "public"."market_service_offers" FOR SELECT TO "authenticated" USING (("provider_profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."owner_user_id" = "auth"."uid"()) AND ("profiles"."account_type" = 'provider'::"text")))));



CREATE POLICY "Providers read own quotes" ON "public"."service_quotes" FOR SELECT TO "authenticated" USING (("provider_profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."owner_user_id" = "auth"."uid"()) AND ("profiles"."account_type" = 'provider'::"text")))));



CREATE POLICY "Providers read own service zones" ON "public"."provider_service_zones" FOR SELECT TO "authenticated" USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."owner_user_id" = "auth"."uid"()) AND ("profiles"."account_type" = 'provider'::"text")))));



CREATE POLICY "Providers read own verification" ON "public"."provider_verifications" FOR SELECT TO "authenticated" USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."owner_user_id" = "auth"."uid"()) AND ("profiles"."account_type" = 'provider'::"text")))));



CREATE POLICY "Providers read own verification documents" ON "public"."provider_verification_documents" FOR SELECT TO "authenticated" USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."owner_user_id" = "auth"."uid"()) AND ("profiles"."account_type" = 'provider'::"text")))));



ALTER TABLE "public"."availability_slots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_financial_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_group_cancellation_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_status_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_tracking_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brain_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brain_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_agent_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_memory_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dispute_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."disputes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."favorites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "klyx_availability_delete" ON "public"."availability_slots" FOR DELETE TO "authenticated" USING ("public"."klyx_owns_user_service"("user_service_id"));



CREATE POLICY "klyx_availability_insert" ON "public"."availability_slots" FOR INSERT TO "authenticated" WITH CHECK ("public"."klyx_owns_user_service"("user_service_id"));



CREATE POLICY "klyx_availability_select" ON "public"."availability_slots" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "klyx_availability_update" ON "public"."availability_slots" FOR UPDATE TO "authenticated" USING ("public"."klyx_owns_user_service"("user_service_id")) WITH CHECK ("public"."klyx_owns_user_service"("user_service_id"));



CREATE POLICY "klyx_booking_status_events_select" ON "public"."booking_status_events" FOR SELECT TO "authenticated" USING ("public"."klyx_owns_booking"("booking_id"));



CREATE POLICY "klyx_bookings_insert" ON "public"."bookings" FOR INSERT TO "authenticated" WITH CHECK (("public"."klyx_owns_profile"("parent_id") AND "public"."klyx_profile_has_type"("parent_id", 'client'::"text") AND "public"."klyx_profile_has_type"(COALESCE("provider_id", "babysitter_id"), 'provider'::"text") AND ("parent_id" <> COALESCE("provider_id", "babysitter_id"))));



CREATE POLICY "klyx_bookings_select" ON "public"."bookings" FOR SELECT TO "authenticated" USING (("public"."klyx_owns_profile"("parent_id") OR "public"."klyx_owns_profile"(COALESCE("provider_id", "babysitter_id"))));



CREATE POLICY "klyx_brain_conversations_all" ON "public"."brain_conversations" TO "authenticated" USING ("public"."klyx_owns_profile"("user_id")) WITH CHECK ("public"."klyx_owns_profile"("user_id"));



CREATE POLICY "klyx_brain_messages_all" ON "public"."brain_messages" TO "authenticated" USING ("public"."klyx_owns_conversation"("conversation_id")) WITH CHECK ("public"."klyx_owns_conversation"("conversation_id"));



CREATE POLICY "klyx_favorites_all" ON "public"."favorites" TO "authenticated" USING ("public"."klyx_owns_profile"("user_id")) WITH CHECK (("public"."klyx_owns_profile"("user_id") AND "public"."klyx_profile_has_type"("user_id", 'client'::"text")));



CREATE POLICY "klyx_memory_events_all" ON "public"."user_memory_events" TO "authenticated" USING ("public"."klyx_owns_profile"("user_id")) WITH CHECK ("public"."klyx_owns_profile"("user_id"));



CREATE POLICY "klyx_messages_insert" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK (("public"."klyx_owns_profile"("sender_id") AND "public"."klyx_valid_message_participants"("booking_id", "sender_id", "receiver_id")));



CREATE POLICY "klyx_messages_select" ON "public"."messages" FOR SELECT TO "authenticated" USING ("public"."klyx_owns_booking"("booking_id"));



CREATE POLICY "klyx_messages_update" ON "public"."messages" FOR UPDATE TO "authenticated" USING ("public"."klyx_owns_profile"("receiver_id")) WITH CHECK ("public"."klyx_owns_profile"("receiver_id"));



CREATE POLICY "klyx_notifications_all" ON "public"."notifications" TO "authenticated" USING ("public"."klyx_owns_profile"("user_id")) WITH CHECK ("public"."klyx_owns_profile"("user_id"));



CREATE POLICY "klyx_profiles_delete" ON "public"."profiles" FOR DELETE TO "authenticated" USING (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "klyx_profiles_insert" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "klyx_profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated", "anon" USING ((("account_type" = 'provider'::"text") OR ("owner_user_id" = "auth"."uid"()) OR "public"."klyx_shares_booking_with_profile"("id")));



CREATE POLICY "klyx_profiles_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("owner_user_id" = "auth"."uid"())) WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "klyx_project_services_all" ON "public"."project_services" TO "authenticated" USING ("public"."klyx_owns_project"("project_id")) WITH CHECK ("public"."klyx_owns_project"("project_id"));



CREATE POLICY "klyx_projects_all" ON "public"."projects" TO "authenticated" USING ("public"."klyx_owns_profile"("user_id")) WITH CHECK ("public"."klyx_owns_profile"("user_id"));



CREATE POLICY "klyx_provider_documents_delete" ON "public"."provider_documents" FOR DELETE TO "authenticated" USING ("public"."klyx_owns_profile"("profile_id"));



CREATE POLICY "klyx_provider_documents_insert" ON "public"."provider_documents" FOR INSERT TO "authenticated" WITH CHECK (("public"."klyx_owns_profile"("profile_id") AND "public"."klyx_profile_has_type"("profile_id", 'provider'::"text")));



CREATE POLICY "klyx_provider_documents_select" ON "public"."provider_documents" FOR SELECT TO "authenticated" USING ("public"."klyx_owns_profile"("profile_id"));



CREATE POLICY "klyx_provider_documents_update" ON "public"."provider_documents" FOR UPDATE TO "authenticated" USING ("public"."klyx_owns_profile"("profile_id")) WITH CHECK ("public"."klyx_owns_profile"("profile_id"));



CREATE POLICY "klyx_provider_gallery_delete" ON "public"."provider_gallery" FOR DELETE TO "authenticated" USING ("public"."klyx_owns_profile"("profile_id"));



CREATE POLICY "klyx_provider_gallery_insert" ON "public"."provider_gallery" FOR INSERT TO "authenticated" WITH CHECK (("public"."klyx_owns_profile"("profile_id") AND "public"."klyx_profile_has_type"("profile_id", 'provider'::"text")));



CREATE POLICY "klyx_provider_gallery_select" ON "public"."provider_gallery" FOR SELECT TO "authenticated", "anon" USING (("public"."klyx_owns_profile"("profile_id") OR (EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "provider_profile"
  WHERE (("provider_profile"."profile_id" = "provider_gallery"."profile_id") AND ("provider_profile"."is_published" = true))))));



CREATE POLICY "klyx_provider_gallery_update" ON "public"."provider_gallery" FOR UPDATE TO "authenticated" USING ("public"."klyx_owns_profile"("profile_id")) WITH CHECK ("public"."klyx_owns_profile"("profile_id"));



CREATE POLICY "klyx_provider_profiles_delete" ON "public"."provider_profiles" FOR DELETE TO "authenticated" USING ("public"."klyx_owns_profile"("profile_id"));



CREATE POLICY "klyx_provider_profiles_insert" ON "public"."provider_profiles" FOR INSERT TO "authenticated" WITH CHECK (("public"."klyx_owns_profile"("profile_id") AND "public"."klyx_profile_has_type"("profile_id", 'provider'::"text")));



CREATE POLICY "klyx_provider_profiles_select" ON "public"."provider_profiles" FOR SELECT TO "authenticated", "anon" USING ((("is_published" = true) OR "public"."klyx_owns_profile"("profile_id")));



CREATE POLICY "klyx_provider_profiles_update" ON "public"."provider_profiles" FOR UPDATE TO "authenticated" USING ("public"."klyx_owns_profile"("profile_id")) WITH CHECK (("public"."klyx_owns_profile"("profile_id") AND "public"."klyx_profile_has_type"("profile_id", 'provider'::"text")));



CREATE POLICY "klyx_reviews_insert" ON "public"."reviews" FOR INSERT TO "authenticated" WITH CHECK (("public"."klyx_owns_profile"("author_id") AND "public"."klyx_can_review"("booking_id", "author_id", "target_id")));



CREATE POLICY "klyx_reviews_select" ON "public"."reviews" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "klyx_reviews_update" ON "public"."reviews" FOR UPDATE TO "authenticated" USING ("public"."klyx_owns_profile"("author_id")) WITH CHECK (("public"."klyx_owns_profile"("author_id") AND "public"."klyx_can_review"("booking_id", "author_id", "target_id")));



CREATE POLICY "klyx_service_profiles_delete" ON "public"."service_profiles" FOR DELETE TO "authenticated" USING ("public"."klyx_owns_user_service"("user_service_id"));



CREATE POLICY "klyx_service_profiles_insert" ON "public"."service_profiles" FOR INSERT TO "authenticated" WITH CHECK ("public"."klyx_owns_user_service"("user_service_id"));



CREATE POLICY "klyx_service_profiles_select" ON "public"."service_profiles" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."user_services" "us"
  WHERE (("us"."id" = "service_profiles"."user_service_id") AND (("us"."active" = true) OR "public"."klyx_owns_profile"("us"."user_id"))))));



CREATE POLICY "klyx_service_profiles_update" ON "public"."service_profiles" FOR UPDATE TO "authenticated" USING ("public"."klyx_owns_user_service"("user_service_id")) WITH CHECK ("public"."klyx_owns_user_service"("user_service_id"));



CREATE POLICY "klyx_service_requests_all" ON "public"."service_requests" TO "authenticated" USING ("public"."klyx_owns_profile"("user_id")) WITH CHECK ("public"."klyx_owns_profile"("user_id"));



CREATE POLICY "klyx_services_select" ON "public"."services" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "klyx_stores_all" ON "public"."stores" TO "authenticated" USING ("public"."klyx_owns_profile"("owner_id")) WITH CHECK ("public"."klyx_owns_profile"("owner_id"));



CREATE POLICY "klyx_tracking_select" ON "public"."booking_tracking_events" FOR SELECT TO "authenticated" USING ("public"."klyx_owns_booking"("booking_id"));



CREATE POLICY "klyx_user_notifications_all" ON "public"."user_notifications" TO "authenticated" USING ("public"."klyx_owns_profile"("user_id")) WITH CHECK ("public"."klyx_owns_profile"("user_id"));



CREATE POLICY "klyx_user_preferences_all" ON "public"."user_preferences" TO "authenticated" USING ("public"."klyx_owns_profile"("user_id")) WITH CHECK ("public"."klyx_owns_profile"("user_id"));



CREATE POLICY "klyx_user_services_delete" ON "public"."user_services" FOR DELETE TO "authenticated" USING ("public"."klyx_owns_profile"("user_id"));



CREATE POLICY "klyx_user_services_insert" ON "public"."user_services" FOR INSERT TO "authenticated" WITH CHECK (("public"."klyx_owns_profile"("user_id") AND "public"."klyx_profile_has_type"("user_id", 'provider'::"text")));



CREATE POLICY "klyx_user_services_select" ON "public"."user_services" FOR SELECT TO "authenticated", "anon" USING ((("active" = true) OR "public"."klyx_owns_profile"("user_id")));



CREATE POLICY "klyx_user_services_update" ON "public"."user_services" FOR UPDATE TO "authenticated" USING ("public"."klyx_owns_profile"("user_id")) WITH CHECK ("public"."klyx_owns_profile"("user_id"));



ALTER TABLE "public"."market_request_provider_candidates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."market_service_offers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."market_service_request_slots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."market_service_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."market_split_plan_confirmations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."phone_contact_access_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."phone_verification_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."photo_service_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_risk_assessments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_assistant_drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_gallery" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_service_zones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_skill_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_skill_verifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_verification_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_verifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_proposals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_quotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."skill_qualification_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."split_booking_batch_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."split_booking_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."split_booking_payment_confirmations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."split_booking_payment_refunds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."split_booking_payment_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."split_booking_payment_units" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."split_booking_price_confirmations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."split_booking_proof_consumptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sumsub_webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_memory_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_services" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_attach_split_checkout_13_27"("p_unit_id" "uuid", "p_attempt_token" "text", "p_checkout_session_id" "text", "p_checkout_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_attach_split_checkout_13_27"("p_unit_id" "uuid", "p_attempt_token" "text", "p_checkout_session_id" "text", "p_checkout_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_attach_split_checkout_13_27"("p_unit_id" "uuid", "p_attempt_token" "text", "p_checkout_session_id" "text", "p_checkout_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."klyx_block_split_payment_reconfirmation_13_27"() TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_block_split_payment_reconfirmation_13_27"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_block_split_payment_reconfirmation_13_27"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_can_review"("booking_id" "uuid", "author_id" "uuid", "target_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_can_review"("booking_id" "uuid", "author_id" "uuid", "target_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_can_review"("booking_id" "uuid", "author_id" "uuid", "target_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_can_review"("booking_id" "uuid", "author_id" "uuid", "target_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_claim_booking_group_payment"("p_group_id" "uuid", "p_client_profile_id" "uuid", "p_attempt_token" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_claim_booking_group_payment"("p_group_id" "uuid", "p_client_profile_id" "uuid", "p_attempt_token" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_claim_booking_payment"("p_booking_id" "uuid", "p_client_profile_id" "uuid", "p_attempt_token" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_claim_booking_payment"("p_booking_id" "uuid", "p_client_profile_id" "uuid", "p_attempt_token" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_claim_split_payment_unit_13_27"("p_unit_id" "uuid", "p_client_profile_id" "uuid", "p_attempt_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_claim_split_payment_unit_13_27"("p_unit_id" "uuid", "p_client_profile_id" "uuid", "p_attempt_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_claim_split_payment_unit_13_27"("p_unit_id" "uuid", "p_client_profile_id" "uuid", "p_attempt_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_confirm_split_booking_prices_13_23"("p_batch_id" "uuid", "p_client_profile_id" "uuid", "p_price_hash" "text", "p_price_snapshot" "jsonb", "p_item_count" integer, "p_total_amount_cents" bigint, "p_currency" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_confirm_split_booking_prices_13_23"("p_batch_id" "uuid", "p_client_profile_id" "uuid", "p_price_hash" "text", "p_price_snapshot" "jsonb", "p_item_count" integer, "p_total_amount_cents" bigint, "p_currency" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_confirm_split_booking_prices_13_23"("p_batch_id" "uuid", "p_client_profile_id" "uuid", "p_price_hash" "text", "p_price_snapshot" "jsonb", "p_item_count" integer, "p_total_amount_cents" bigint, "p_currency" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_confirm_split_payment_plan_13_26"("p_batch_id" "uuid", "p_client_profile_id" "uuid", "p_price_confirmation_id" "uuid", "p_payment_plan_hash" "text", "p_payment_plan_snapshot" "jsonb", "p_provider_count" integer, "p_payment_unit_count" integer, "p_total_amount_cents" bigint, "p_currency" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_confirm_split_payment_plan_13_26"("p_batch_id" "uuid", "p_client_profile_id" "uuid", "p_price_confirmation_id" "uuid", "p_payment_plan_hash" "text", "p_payment_plan_snapshot" "jsonb", "p_provider_count" integer, "p_payment_unit_count" integer, "p_total_amount_cents" bigint, "p_currency" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_confirm_split_payment_plan_13_26"("p_batch_id" "uuid", "p_client_profile_id" "uuid", "p_price_confirmation_id" "uuid", "p_payment_plan_hash" "text", "p_payment_plan_snapshot" "jsonb", "p_provider_count" integer, "p_payment_unit_count" integer, "p_total_amount_cents" bigint, "p_currency" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_confirm_split_plan_13_18"("p_request_id" "uuid", "p_client_profile_id" "uuid", "p_plan_hash" "text", "p_plan_snapshot" "jsonb", "p_slot_count" integer, "p_provider_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_confirm_split_plan_13_18"("p_request_id" "uuid", "p_client_profile_id" "uuid", "p_plan_hash" "text", "p_plan_snapshot" "jsonb", "p_slot_count" integer, "p_provider_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_confirm_split_plan_13_18"("p_request_id" "uuid", "p_client_profile_id" "uuid", "p_plan_hash" "text", "p_plan_snapshot" "jsonb", "p_slot_count" integer, "p_provider_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."klyx_consume_split_booking_proof_13_20"() TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_consume_split_booking_proof_13_20"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_consume_split_booking_proof_13_20"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_create_multi_slot_booking_group"("p_market_request_id" "uuid", "p_client_profile_id" "uuid", "p_offer_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_create_multi_slot_booking_group"("p_market_request_id" "uuid", "p_client_profile_id" "uuid", "p_offer_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_create_profile"("p_first_name" "text", "p_last_name" "text", "p_city" "text", "p_account_type" "text", "p_service_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_create_profile"("p_first_name" "text", "p_last_name" "text", "p_city" "text", "p_account_type" "text", "p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_create_profile"("p_first_name" "text", "p_last_name" "text", "p_city" "text", "p_account_type" "text", "p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_create_profile"("p_first_name" "text", "p_last_name" "text", "p_city" "text", "p_account_type" "text", "p_service_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_delete_profile"("p_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_delete_profile"("p_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_delete_profile"("p_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_delete_profile"("p_profile_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_enforce_group_live_coverage_12_96"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_enforce_group_live_coverage_12_96"() TO "service_role";



GRANT ALL ON FUNCTION "public"."klyx_enforce_group_provider_accept_live_13_06"() TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_enforce_group_provider_accept_live_13_06"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_enforce_group_provider_accept_live_13_06"() TO "service_role";



GRANT ALL ON FUNCTION "public"."klyx_enforce_multi_slot_offer_live_13_09"() TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_enforce_multi_slot_offer_live_13_09"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_enforce_multi_slot_offer_live_13_09"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_finalize_split_payment_run_13_27"("p_run_id" "uuid", "p_client_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_finalize_split_payment_run_13_27"("p_run_id" "uuid", "p_client_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_finalize_split_payment_run_13_27"("p_run_id" "uuid", "p_client_profile_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_group_live_coverage_check"("p_request_id" "uuid", "p_provider_profile_id" "uuid", "p_user_service_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_group_live_coverage_check"("p_request_id" "uuid", "p_provider_profile_id" "uuid", "p_user_service_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_owns_avatar_path"("object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_owns_avatar_path"("object_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_owns_avatar_path"("object_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_owns_avatar_path"("object_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_owns_booking"("booking_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_owns_booking"("booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_owns_booking"("booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_owns_booking"("booking_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_owns_conversation"("conversation_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_owns_conversation"("conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_owns_conversation"("conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_owns_conversation"("conversation_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_owns_profile"("profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_owns_profile"("profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_owns_profile"("profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_owns_profile"("profile_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_owns_project"("project_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_owns_project"("project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_owns_project"("project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_owns_project"("project_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_owns_user_service"("user_service_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_owns_user_service"("user_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_owns_user_service"("user_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_owns_user_service"("user_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."klyx_prepare_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_prepare_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_prepare_profile"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_prevent_provider_booking_overlap"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_prevent_provider_booking_overlap"() TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_prevent_provider_booking_overlap"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_prevent_provider_booking_overlap"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_profile_has_type"("profile_id" "uuid", "expected_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_profile_has_type"("profile_id" "uuid", "expected_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_profile_has_type"("profile_id" "uuid", "expected_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_profile_has_type"("profile_id" "uuid", "expected_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_protect_paid_booking"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_protect_paid_booking"() TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_protect_paid_booking"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_protect_paid_booking"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_provider_group_decision"("p_group_id" "uuid", "p_provider_profile_id" "uuid", "p_action" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_provider_group_decision"("p_group_id" "uuid", "p_provider_profile_id" "uuid", "p_action" "text", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_recompute_split_refund_run_13_28"("p_run_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_recompute_split_refund_run_13_28"("p_run_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_recompute_split_refund_run_13_28"("p_run_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_release_expired_booking_checkout"("p_booking_id" "uuid", "p_checkout_session_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_release_expired_booking_checkout"("p_booking_id" "uuid", "p_checkout_session_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_release_split_checkout_13_27"("p_unit_id" "uuid", "p_checkout_session_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_release_split_checkout_13_27"("p_unit_id" "uuid", "p_checkout_session_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_release_split_checkout_13_27"("p_unit_id" "uuid", "p_checkout_session_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_resolve_group_cancellation"("p_group_id" "uuid", "p_actor_profile_id" "uuid", "p_decision" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_resolve_group_cancellation"("p_group_id" "uuid", "p_actor_profile_id" "uuid", "p_decision" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_security_audit"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_security_audit"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_shares_booking_with_profile"("other_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_shares_booking_with_profile"("other_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_shares_booking_with_profile"("other_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_shares_booking_with_profile"("other_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."klyx_split_batch_integrity_13_20"() TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_split_batch_integrity_13_20"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_split_batch_integrity_13_20"() TO "service_role";



GRANT ALL ON FUNCTION "public"."klyx_split_batch_item_count_13_20"() TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_split_batch_item_count_13_20"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_split_batch_item_count_13_20"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."klyx_valid_message_participants"("booking_id" "uuid", "sender_id" "uuid", "receiver_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."klyx_valid_message_participants"("booking_id" "uuid", "sender_id" "uuid", "receiver_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."klyx_valid_message_participants"("booking_id" "uuid", "sender_id" "uuid", "receiver_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."klyx_valid_message_participants"("booking_id" "uuid", "sender_id" "uuid", "receiver_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_booking_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_booking_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_booking_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_new_booking"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_new_booking"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_new_booking"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_new_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_new_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_new_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_service_profile_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_service_profile_rating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_service_profile_rating"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_booking_availability"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_booking_availability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_booking_availability"() TO "service_role";



GRANT ALL ON TABLE "public"."availability_slots" TO "anon";
GRANT ALL ON TABLE "public"."availability_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."availability_slots" TO "service_role";



GRANT ALL ON TABLE "public"."booking_financial_ledger" TO "anon";
GRANT ALL ON TABLE "public"."booking_financial_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_financial_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."booking_group_cancellation_events" TO "anon";
GRANT ALL ON TABLE "public"."booking_group_cancellation_events" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_group_cancellation_events" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."booking_groups" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."booking_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_groups" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."booking_status_events" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."booking_status_events" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_status_events" TO "service_role";



GRANT ALL ON TABLE "public"."booking_tracking_events" TO "anon";
GRANT ALL ON TABLE "public"."booking_tracking_events" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_tracking_events" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."brain_conversations" TO "anon";
GRANT ALL ON TABLE "public"."brain_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."brain_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."brain_messages" TO "anon";
GRANT ALL ON TABLE "public"."brain_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."brain_messages" TO "service_role";



GRANT ALL ON TABLE "public"."client_agent_plans" TO "anon";
GRANT ALL ON TABLE "public"."client_agent_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."client_agent_plans" TO "service_role";



GRANT ALL ON TABLE "public"."client_memory_profiles" TO "anon";
GRANT ALL ON TABLE "public"."client_memory_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."client_memory_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."dispute_events" TO "anon";
GRANT ALL ON TABLE "public"."dispute_events" TO "authenticated";
GRANT ALL ON TABLE "public"."dispute_events" TO "service_role";



GRANT ALL ON TABLE "public"."disputes" TO "anon";
GRANT ALL ON TABLE "public"."disputes" TO "authenticated";
GRANT ALL ON TABLE "public"."disputes" TO "service_role";



GRANT ALL ON TABLE "public"."favorites" TO "anon";
GRANT ALL ON TABLE "public"."favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."favorites" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."market_request_provider_candidates" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."market_request_provider_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."market_request_provider_candidates" TO "service_role";



GRANT ALL ON TABLE "public"."market_service_offers" TO "anon";
GRANT ALL ON TABLE "public"."market_service_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."market_service_offers" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."market_service_request_slots" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."market_service_request_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."market_service_request_slots" TO "service_role";



GRANT ALL ON TABLE "public"."market_service_requests" TO "anon";
GRANT ALL ON TABLE "public"."market_service_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."market_service_requests" TO "service_role";



GRANT ALL ON TABLE "public"."market_split_plan_confirmations" TO "anon";
GRANT ALL ON TABLE "public"."market_split_plan_confirmations" TO "authenticated";
GRANT ALL ON TABLE "public"."market_split_plan_confirmations" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."phone_contact_access_logs" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."phone_contact_access_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."phone_contact_access_logs" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."phone_verification_limits" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."phone_verification_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."phone_verification_limits" TO "service_role";



GRANT ALL ON TABLE "public"."photo_service_requests" TO "anon";
GRANT ALL ON TABLE "public"."photo_service_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."photo_service_requests" TO "service_role";



GRANT ALL ON TABLE "public"."profile_risk_assessments" TO "anon";
GRANT ALL ON TABLE "public"."profile_risk_assessments" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_risk_assessments" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."project_services" TO "anon";
GRANT ALL ON TABLE "public"."project_services" TO "authenticated";
GRANT ALL ON TABLE "public"."project_services" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."provider_assistant_drafts" TO "anon";
GRANT ALL ON TABLE "public"."provider_assistant_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_assistant_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."provider_documents" TO "anon";
GRANT ALL ON TABLE "public"."provider_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_documents" TO "service_role";



GRANT ALL ON TABLE "public"."provider_gallery" TO "anon";
GRANT ALL ON TABLE "public"."provider_gallery" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_gallery" TO "service_role";



GRANT ALL ON TABLE "public"."provider_profiles" TO "anon";
GRANT ALL ON TABLE "public"."provider_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."provider_service_zones" TO "anon";
GRANT ALL ON TABLE "public"."provider_service_zones" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_service_zones" TO "service_role";



GRANT ALL ON TABLE "public"."provider_skill_documents" TO "anon";
GRANT ALL ON TABLE "public"."provider_skill_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_skill_documents" TO "service_role";



GRANT ALL ON TABLE "public"."provider_skill_verifications" TO "anon";
GRANT ALL ON TABLE "public"."provider_skill_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_skill_verifications" TO "service_role";



GRANT ALL ON TABLE "public"."provider_verification_documents" TO "anon";
GRANT ALL ON TABLE "public"."provider_verification_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_verification_documents" TO "service_role";



GRANT ALL ON TABLE "public"."provider_verifications" TO "anon";
GRANT ALL ON TABLE "public"."provider_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_verifications" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."security_alerts" TO "anon";
GRANT ALL ON TABLE "public"."security_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."security_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."service_profiles" TO "anon";
GRANT ALL ON TABLE "public"."service_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."service_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."service_proposals" TO "anon";
GRANT ALL ON TABLE "public"."service_proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."service_proposals" TO "service_role";



GRANT ALL ON TABLE "public"."service_quotes" TO "anon";
GRANT ALL ON TABLE "public"."service_quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."service_quotes" TO "service_role";



GRANT ALL ON TABLE "public"."service_requests" TO "anon";
GRANT ALL ON TABLE "public"."service_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."service_requests" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."skill_qualification_rules" TO "anon";
GRANT ALL ON TABLE "public"."skill_qualification_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."skill_qualification_rules" TO "service_role";



GRANT ALL ON TABLE "public"."split_booking_batch_items" TO "anon";
GRANT ALL ON TABLE "public"."split_booking_batch_items" TO "authenticated";
GRANT ALL ON TABLE "public"."split_booking_batch_items" TO "service_role";



GRANT ALL ON TABLE "public"."split_booking_batches" TO "anon";
GRANT ALL ON TABLE "public"."split_booking_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."split_booking_batches" TO "service_role";



GRANT ALL ON TABLE "public"."split_booking_payment_confirmations" TO "anon";
GRANT ALL ON TABLE "public"."split_booking_payment_confirmations" TO "authenticated";
GRANT ALL ON TABLE "public"."split_booking_payment_confirmations" TO "service_role";



GRANT ALL ON TABLE "public"."split_booking_payment_refunds" TO "anon";
GRANT ALL ON TABLE "public"."split_booking_payment_refunds" TO "authenticated";
GRANT ALL ON TABLE "public"."split_booking_payment_refunds" TO "service_role";



GRANT ALL ON TABLE "public"."split_booking_payment_runs" TO "anon";
GRANT ALL ON TABLE "public"."split_booking_payment_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."split_booking_payment_runs" TO "service_role";



GRANT ALL ON TABLE "public"."split_booking_payment_units" TO "anon";
GRANT ALL ON TABLE "public"."split_booking_payment_units" TO "authenticated";
GRANT ALL ON TABLE "public"."split_booking_payment_units" TO "service_role";



GRANT ALL ON TABLE "public"."split_booking_price_confirmations" TO "anon";
GRANT ALL ON TABLE "public"."split_booking_price_confirmations" TO "authenticated";
GRANT ALL ON TABLE "public"."split_booking_price_confirmations" TO "service_role";



GRANT ALL ON TABLE "public"."split_booking_proof_consumptions" TO "anon";
GRANT ALL ON TABLE "public"."split_booking_proof_consumptions" TO "authenticated";
GRANT ALL ON TABLE "public"."split_booking_proof_consumptions" TO "service_role";



GRANT ALL ON TABLE "public"."stores" TO "anon";
GRANT ALL ON TABLE "public"."stores" TO "authenticated";
GRANT ALL ON TABLE "public"."stores" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."sumsub_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."sumsub_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."sumsub_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."user_memory_events" TO "anon";
GRANT ALL ON TABLE "public"."user_memory_events" TO "authenticated";
GRANT ALL ON TABLE "public"."user_memory_events" TO "service_role";



GRANT ALL ON TABLE "public"."user_notifications" TO "anon";
GRANT ALL ON TABLE "public"."user_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_services" TO "anon";
GRANT ALL ON TABLE "public"."user_services" TO "authenticated";
GRANT ALL ON TABLE "public"."user_services" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







