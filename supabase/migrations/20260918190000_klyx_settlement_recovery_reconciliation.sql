-- KLYX SETTLEMENT RECOVERY / RECONCILIATION — MISSION 4
--
-- Additive, server-only control plane for reconciling single-booking
-- platform-held settlements against observed Stripe TEST truth.
--
-- This migration NEVER performs a Stripe side effect. It only applies an
-- already-verified observation atomically. Group/split remain unsupported.

begin;

alter table public.booking_settlements
  add column if not exists recovery_attempt_number integer not null default 0
    check (recovery_attempt_number >= 0),
  add column if not exists last_recovery_status text not null default 'never'
    check (last_recovery_status in (
      'never',
      'pending',
      'reconciled',
      'failed',
      'review_required'
    )),
  add column if not exists last_reconciled_at timestamptz;

create table if not exists public.booking_settlement_recovery_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null
    references public.booking_settlements(booking_id) on delete restrict,
  observation_key text not null,
  action text not null
    check (action in (
      'observe_healthy',
      'observe_pending',
      'observe_failed',
      'reconcile_release',
      'reconcile_no_transfer',
      'reconcile_reversal',
      'reconcile_refund_without_transfer',
      'review_required'
    )),
  state_before text not null,
  state_after text not null,
  stripe_transfer_id text,
  stripe_transfer_reversal_id text,
  reason_codes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(reason_codes) = 'array'),
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object'),
  observed_at timestamptz not null default now(),
  unique (booking_id, observation_key)
);

create index if not exists booking_settlement_recovery_events_booking_idx
  on public.booking_settlement_recovery_events(booking_id, observed_at desc);

create index if not exists booking_settlements_recovery_status_idx
  on public.booking_settlements(last_recovery_status, updated_at);

alter table public.booking_settlement_recovery_events enable row level security;

revoke all privileges on table public.booking_settlement_recovery_events
  from public, anon, authenticated;
grant select, insert on table public.booking_settlement_recovery_events
  to service_role;

create or replace function public.klyx_apply_booking_settlement_recovery(
  p_booking_id uuid,
  p_action text,
  p_observation_key text,
  p_stripe_transfer_id text default null,
  p_stripe_transfer_reversal_id text default null,
  p_reason_codes jsonb default '[]'::jsonb,
  p_details jsonb default '{}'::jsonb
)
returns table (
  result text,
  state_before text,
  state_after text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.booking_settlements%rowtype;
  v_booking record;
  v_before text;
  v_after text;
  v_status text;
  v_duplicate boolean := false;
  v_refund_active boolean := false;
  v_refund_terminal boolean := false;
begin
  if coalesce(trim(p_observation_key), '') = '' then
    raise exception 'KLYX_SETTLEMENT_RECOVERY_OBSERVATION_KEY_REQUIRED';
  end if;

  if p_action not in (
    'observe_healthy',
    'observe_pending',
    'observe_failed',
    'reconcile_release',
    'reconcile_no_transfer',
    'reconcile_reversal',
    'reconcile_refund_without_transfer',
    'review_required'
  ) then
    raise exception 'KLYX_SETTLEMENT_RECOVERY_ACTION_INVALID';
  end if;

  if p_reason_codes is null or jsonb_typeof(p_reason_codes) <> 'array' then
    raise exception 'KLYX_SETTLEMENT_RECOVERY_REASON_CODES_INVALID';
  end if;

  if p_details is null or jsonb_typeof(p_details) <> 'object' then
    raise exception 'KLYX_SETTLEMENT_RECOVERY_DETAILS_INVALID';
  end if;

  select s.*
    into v_settlement
    from public.booking_settlements as s
   where s.booking_id = p_booking_id
   for update;

  if not found then
    return query select 'not_applicable'::text, null::text, null::text;
    return;
  end if;

  select b.payment_mode, b.booking_group_id, b.payment_status, b.refund_status
    into v_booking
    from public.bookings as b
   where b.id = p_booking_id;

  if not found
     or coalesce(v_booking.payment_mode, '') <> 'platform_held'
     or v_booking.booking_group_id is not null
     or v_settlement.payment_mode <> 'platform_held' then
    return query
      select 'not_applicable'::text, v_settlement.state, v_settlement.state;
    return;
  end if;

  if exists (
    select 1
      from public.booking_settlement_recovery_events e
     where e.booking_id = p_booking_id
       and e.observation_key = p_observation_key
  ) then
    return query
      select 'duplicate'::text, v_settlement.state, v_settlement.state;
    return;
  end if;

  v_before := v_settlement.state;
  v_after := v_before;
  v_status := v_settlement.last_recovery_status;
  v_refund_active :=
    coalesce(v_booking.refund_status, '') in ('processing', 'succeeded')
    or coalesce(v_booking.payment_status, '') = 'refunded'
    or v_settlement.state in ('refund_pending', 'refunded');
  v_refund_terminal :=
    coalesce(v_booking.refund_status, '') = 'succeeded'
    or coalesce(v_booking.payment_status, '') = 'refunded';

  if p_action = 'review_required' then
    v_status := 'review_required';

    if v_settlement.state <> 'refunded' then
      v_after := 'review_required';
    end if;

    update public.booking_settlements as s
       set state = v_after,
           last_recovery_status = 'review_required',
           last_reconciled_at = now(),
           recovery_attempt_number = s.recovery_attempt_number + 1,
           release_reason_codes =
             coalesce(s.release_reason_codes, '[]'::jsonb)
             || coalesce(p_reason_codes, '[]'::jsonb),
           release_claim_token = case
             when v_after = 'review_required' then null
             else s.release_claim_token
           end,
           release_claimed_at = case
             when v_after = 'review_required' then null
             else s.release_claimed_at
           end,
           last_error_code = 'settlement_recovery_review_required',
           last_error_message = left(
             coalesce(p_details ->> 'summary', 'Settlement recovery requires human review.'),
             1000
           ),
           updated_at = now()
     where s.booking_id = p_booking_id;

  elsif p_action = 'reconcile_release' then
    if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$' then
      raise exception 'KLYX_SETTLEMENT_RECOVERY_TRANSFER_ID_INVALID';
    end if;

    if v_settlement.state = 'review_required' then
      v_after := 'review_required';
      v_status := 'review_required';
    elsif v_settlement.stripe_transfer_id is not null
       and v_settlement.stripe_transfer_id <> p_stripe_transfer_id then
      v_after := 'review_required';
      v_status := 'review_required';
    elsif v_refund_active then
      v_after := 'refund_pending';
      v_status := 'reconciled';
    elsif v_settlement.state in ('held', 'release_failed', 'release_claimed', 'released') then
      v_after := 'released';
      v_status := 'reconciled';
    else
      v_after := 'review_required';
      v_status := 'review_required';
    end if;

    update public.booking_settlements as s
       set state = v_after,
           stripe_transfer_id = case
             when v_after <> 'review_required'
               then coalesce(s.stripe_transfer_id, p_stripe_transfer_id)
             else s.stripe_transfer_id
           end,
           released_at = case
             when v_after in ('released', 'refund_pending')
               then coalesce(s.released_at, now())
             else s.released_at
           end,
           release_claim_token = case
             when v_after in ('released', 'refund_pending', 'review_required')
               then null
             else s.release_claim_token
           end,
           release_claimed_at = case
             when v_after in ('released', 'refund_pending', 'review_required')
               then null
             else s.release_claimed_at
           end,
           last_recovery_status = v_status,
           last_reconciled_at = now(),
           recovery_attempt_number = s.recovery_attempt_number + 1,
           last_error_code = case
             when v_status = 'review_required'
               then 'settlement_recovery_release_conflict'
             else null
           end,
           last_error_message = case
             when v_status = 'review_required'
               then 'Observed Stripe Transfer conflicts with settlement DB truth.'
             else null
           end,
           updated_at = now()
     where s.booking_id = p_booking_id;

  elsif p_action = 'reconcile_no_transfer' then
    if v_settlement.state = 'release_claimed'
       and v_settlement.release_claimed_at is not null
       and v_settlement.release_claimed_at <= now() - interval '10 minutes'
       and v_settlement.stripe_transfer_id is null then
      v_after := 'release_failed';
      v_status := 'reconciled';

      update public.booking_settlements as s
         set state = 'release_failed',
             release_claim_token = null,
             release_claimed_at = null,
             last_error_code = 'settlement_recovery_no_transfer',
             last_error_message =
               'Expired release claim reconciled only after Stripe truth showed no Transfer.',
             last_recovery_status = 'reconciled',
             last_reconciled_at = now(),
             recovery_attempt_number = s.recovery_attempt_number + 1,
             updated_at = now()
       where s.booking_id = p_booking_id;
    else
      v_after := v_settlement.state;
      v_status := 'pending';

      update public.booking_settlements as s
         set last_recovery_status = 'pending',
             last_reconciled_at = now(),
             recovery_attempt_number = s.recovery_attempt_number + 1,
             updated_at = now()
       where s.booking_id = p_booking_id;
    end if;

  elsif p_action = 'reconcile_reversal' then
    if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$'
       or coalesce(trim(p_stripe_transfer_reversal_id), '') !~ '^trr_[A-Za-z0-9]+$' then
      raise exception 'KLYX_SETTLEMENT_RECOVERY_REVERSAL_ID_INVALID';
    end if;

    if (v_settlement.stripe_transfer_id is not null
        and v_settlement.stripe_transfer_id <> p_stripe_transfer_id)
       or (v_settlement.stripe_transfer_reversal_id is not null
        and v_settlement.stripe_transfer_reversal_id <> p_stripe_transfer_reversal_id) then
      v_after := case
        when v_settlement.state = 'refunded' then 'refunded'
        else 'review_required'
      end;
      v_status := 'review_required';
    else
      v_after := case
        when v_refund_terminal then 'refunded'
        else 'refund_pending'
      end;
      v_status := 'reconciled';
    end if;

    update public.booking_settlements as s
       set state = v_after,
           stripe_transfer_id = case
             when v_status = 'reconciled'
               then coalesce(s.stripe_transfer_id, p_stripe_transfer_id)
             else s.stripe_transfer_id
           end,
           stripe_transfer_reversal_id = case
             when v_status = 'reconciled'
               then coalesce(s.stripe_transfer_reversal_id, p_stripe_transfer_reversal_id)
             else s.stripe_transfer_reversal_id
           end,
           released_at = case
             when v_status = 'reconciled'
               then coalesce(s.released_at, now())
             else s.released_at
           end,
           transfer_reversed_at = case
             when v_status = 'reconciled'
               then coalesce(s.transfer_reversed_at, now())
             else s.transfer_reversed_at
           end,
           refunded_at = case
             when v_after = 'refunded' then coalesce(s.refunded_at, now())
             else s.refunded_at
           end,
           release_claim_token = null,
           release_claimed_at = null,
           last_recovery_status = v_status,
           last_reconciled_at = now(),
           recovery_attempt_number = s.recovery_attempt_number + 1,
           last_error_code = case
             when v_status = 'review_required'
               then 'settlement_recovery_reversal_conflict'
             else null
           end,
           last_error_message = case
             when v_status = 'review_required'
               then 'Observed Stripe reversal conflicts with settlement DB truth.'
             else null
           end,
           updated_at = now()
     where s.booking_id = p_booking_id;

  elsif p_action = 'reconcile_refund_without_transfer' then
    if not v_refund_terminal
       or v_settlement.stripe_transfer_id is not null then
      v_after := case
        when v_settlement.state = 'refunded' then 'refunded'
        else 'review_required'
      end;
      v_status := 'review_required';
    else
      v_after := 'refunded';
      v_status := 'reconciled';
    end if;

    update public.booking_settlements as s
       set state = v_after,
           refunded_at = case
             when v_after = 'refunded' then coalesce(s.refunded_at, now())
             else s.refunded_at
           end,
           release_claim_token = null,
           release_claimed_at = null,
           last_recovery_status = v_status,
           last_reconciled_at = now(),
           recovery_attempt_number = s.recovery_attempt_number + 1,
           last_error_code = case
             when v_status = 'review_required'
               then 'settlement_recovery_refund_conflict'
             else null
           end,
           last_error_message = case
             when v_status = 'review_required'
               then 'Refund terminal truth conflicts with observed Transfer truth.'
             else null
           end,
           updated_at = now()
     where s.booking_id = p_booking_id;

  else
    v_status := case
      when p_action = 'observe_healthy' then 'reconciled'
      when p_action = 'observe_pending' then 'pending'
      else 'failed'
    end;

    update public.booking_settlements as s
       set last_recovery_status = v_status,
           last_reconciled_at = now(),
           recovery_attempt_number = s.recovery_attempt_number + 1,
           last_error_code = case
             when p_action = 'observe_failed'
               then 'settlement_recovery_observation_failed'
             else s.last_error_code
           end,
           last_error_message = case
             when p_action = 'observe_failed'
               then left(
                 coalesce(p_details ->> 'summary', 'Stripe truth could not be observed.'),
                 1000
               )
             else s.last_error_message
           end,
           updated_at = now()
     where s.booking_id = p_booking_id;
  end if;

  select s.state
    into v_after
    from public.booking_settlements as s
   where s.booking_id = p_booking_id;

  insert into public.booking_settlement_recovery_events (
    booking_id,
    observation_key,
    action,
    state_before,
    state_after,
    stripe_transfer_id,
    stripe_transfer_reversal_id,
    reason_codes,
    details
  ) values (
    p_booking_id,
    p_observation_key,
    p_action,
    v_before,
    v_after,
    p_stripe_transfer_id,
    p_stripe_transfer_reversal_id,
    coalesce(p_reason_codes, '[]'::jsonb),
    coalesce(p_details, '{}'::jsonb)
  );

  return query select 'applied'::text, v_before, v_after;
end;
$$;

create or replace function public.klyx_booking_settlement_recovery_metrics()
returns table (
  held_count bigint,
  pending_release_count bigint,
  failed_count bigint,
  review_count bigint,
  released_count bigint,
  reversed_count bigint,
  refunded_count bigint,
  avg_settlement_seconds numeric,
  p95_settlement_seconds numeric
)
language sql
security definer
set search_path = public
as $$
  select
    count(*) filter (where s.state = 'held') as held_count,
    count(*) filter (where s.state = 'release_claimed') as pending_release_count,
    count(*) filter (
      where s.state = 'release_failed'
         or s.last_recovery_status = 'failed'
    ) as failed_count,
    count(*) filter (
      where s.state = 'review_required'
         or s.last_recovery_status = 'review_required'
    ) as review_count,
    count(*) filter (where s.state = 'released') as released_count,
    count(*) filter (
      where s.stripe_transfer_reversal_id is not null
    ) as reversed_count,
    count(*) filter (where s.state = 'refunded') as refunded_count,
    round(avg(
      extract(epoch from (s.released_at - s.created_at))
    ) filter (where s.released_at is not null)::numeric, 3) as avg_settlement_seconds,
    round((
      percentile_cont(0.95) within group (
        order by extract(epoch from (s.released_at - s.created_at))
      ) filter (where s.released_at is not null)
    )::numeric, 3) as p95_settlement_seconds
  from public.booking_settlements s
  where s.payment_mode = 'platform_held';
$$;

revoke all on function public.klyx_apply_booking_settlement_recovery(
  uuid, text, text, text, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.klyx_apply_booking_settlement_recovery(
  uuid, text, text, text, text, jsonb, jsonb
) to service_role;

revoke all on function public.klyx_booking_settlement_recovery_metrics()
  from public, anon, authenticated;
grant execute on function public.klyx_booking_settlement_recovery_metrics()
  to service_role;

comment on table public.booking_settlement_recovery_events is
  'Server-only immutable audit trail for Stripe-observed settlement recovery. Recovery observations never create Stripe money movement.';

comment on function public.klyx_apply_booking_settlement_recovery(uuid, text, text, text, text, jsonb, jsonb) is
  'Applies one idempotent single-booking platform-held recovery observation under row lock after Stripe truth was verified server-side. Group/split are rejected.';

comment on function public.klyx_booking_settlement_recovery_metrics() is
  'Server-only operational metrics for held, pending release, failed, review, released, reversed/refunded settlements and settlement duration.';

commit;
