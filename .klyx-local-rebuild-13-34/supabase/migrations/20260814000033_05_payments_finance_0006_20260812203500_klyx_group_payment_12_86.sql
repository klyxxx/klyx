-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations\20260812203500_klyx_group_payment_12_86.sql
-- SHA256: ae8a57671ff0718a7c1a2d755dd477b2025ad2611c7b0f8c3e7693ca7a4529cb
-- PHASE: 05_payments_finance
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
-- KLYX_GROUP_PAYMENT_12_86

alter table public.booking_groups
  add column if not exists payment_mode text;

alter table public.booking_groups
  add column if not exists application_fee_amount integer;

alter table public.booking_groups
  add column if not exists platform_fee_amount integer;

alter table public.booking_groups
  add column if not exists provider_amount integer;

alter table public.booking_groups
  add column if not exists stripe_checkout_session_id text;

alter table public.booking_groups
  add column if not exists stripe_payment_intent_id text;

alter table public.booking_groups
  add column if not exists payment_attempt_token uuid;

alter table public.booking_groups
  add column if not exists payment_attempt_count integer not null default 0;

alter table public.booking_groups
  add column if not exists payment_checkout_started_at timestamptz;

alter table public.booking_groups
  add column if not exists payment_failure_code text;

alter table public.booking_groups
  add column if not exists payment_failure_message text;

alter table public.booking_groups
  add column if not exists payment_failed_at timestamptz;

alter table public.booking_groups
  add column if not exists paid_at timestamptz;

create index if not exists
  booking_groups_checkout_session_idx
on public.booking_groups (
  stripe_checkout_session_id
);

create index if not exists
  booking_groups_payment_intent_idx
on public.booking_groups (
  stripe_payment_intent_id
);

create or replace function
public.klyx_claim_booking_group_payment(
  p_group_id uuid,
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
set search_path = public
as $$
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

revoke all
on function
public.klyx_claim_booking_group_payment(
  uuid,
  uuid,
  uuid
)
from public, anon, authenticated;

grant execute
on function
public.klyx_claim_booking_group_payment(
  uuid,
  uuid,
  uuid
)
to service_role;