-- KLYX_GROUP_CANCELLATION_RESOLUTION_12_90

alter table public.booking_groups
  add column if not exists cancellation_resolution text
  not null default 'none';

alter table public.booking_groups
  add column if not exists cancellation_resolved_by uuid
  references public.profiles(id)
  on delete set null;

alter table public.booking_groups
  add column if not exists cancellation_resolved_at timestamptz;

alter table public.booking_groups
  add column if not exists stripe_refund_id text;

alter table public.booking_groups
  add column if not exists refunded_amount_cents integer;

alter table public.booking_groups
  add column if not exists refunded_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'booking_groups_cancellation_resolution_check'
  ) then
    alter table public.booking_groups
      add constraint
        booking_groups_cancellation_resolution_check
      check (
        cancellation_resolution in (
          'none',
          'approved',
          'rejected'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'booking_groups_refunded_amount_check'
  ) then
    alter table public.booking_groups
      add constraint
        booking_groups_refunded_amount_check
      check (
        refunded_amount_cents is null
        or refunded_amount_cents >= 0
      );
  end if;
end
$$;

create index if not exists
  booking_groups_stripe_refund_idx
on public.booking_groups (
  stripe_refund_id
);

alter table
  public.booking_group_cancellation_events
drop constraint if exists
  booking_group_cancellation_events_action_check;

alter table
  public.booking_group_cancellation_events
add constraint
  booking_group_cancellation_events_action_check
check (
  action in (
    'requested',
    'withdrawn',
    'resolved',
    'approved',
    'rejected',
    'refund_started',
    'refund_succeeded',
    'refund_failed'
  )
);

-- ===========================================================
-- RESOLUTION ATOMIQUE
-- ===========================================================

create or replace function
public.klyx_resolve_group_cancellation(
  p_group_id uuid,
  p_actor_profile_id uuid,
  p_decision text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
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

revoke all
on function
public.klyx_resolve_group_cancellation(
  uuid,
  uuid,
  text
)
from public, anon, authenticated;

grant execute
on function
public.klyx_resolve_group_cancellation(
  uuid,
  uuid,
  text
)
to service_role;