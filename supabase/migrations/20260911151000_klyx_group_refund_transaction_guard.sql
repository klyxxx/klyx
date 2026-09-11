-- KLYX_GROUP_REFUND_TRANSACTION_GUARD_2026
-- Serialize grouped mission progress against refund approval and make the
-- terminal Stripe refund state crash-safe at the PostgreSQL boundary.

begin;

-- Approval currently performs an application preflight and then an RPC. Lock
-- and re-check the child rows inside the same transaction that claims the paid
-- group refund so tracking cannot win in the gap between those two operations.
create or replace function public.klyx_guard_group_refund_claim_2026()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_started boolean := false;
begin
  if new.refund_status <> 'processing'
     or old.refund_status is not distinct from 'processing' then
    return new;
  end if;

  perform id
  from public.bookings
  where booking_group_id = new.id
  order by id
  for update;

  select exists (
    select 1
    from public.bookings
    where booking_group_id = new.id
      and (
        status = 'completed'
        or provider_finished_at is not null
        or service_status in ('en_route', 'arrived', 'in_progress', 'completed')
      )
  )
  into v_started;

  if v_started then
    raise exception 'KLYX_GROUP_CANCEL_ALREADY_STARTED'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists klyx_group_refund_claim_2026
  on public.booking_groups;

create trigger klyx_group_refund_claim_2026
before update of refund_status
on public.booking_groups
for each row
execute function public.klyx_guard_group_refund_claim_2026();

-- After the paid-group refund claim commits, mission progress is incompatible
-- with that refund. Cancellation/refund finalization remains allowed.
create or replace function public.klyx_guard_group_refund_booking_transition_2026()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_group_refund_status text;
  v_group_resolution text;
  v_group_payment_status text;
begin
  if new.booking_group_id is null then
    return new;
  end if;

  if new.status is not distinct from old.status
     and new.service_status is not distinct from old.service_status
     and new.provider_finished_at is not distinct from old.provider_finished_at
     and new.client_confirmed_at is not distinct from old.client_confirmed_at then
    return new;
  end if;

  select refund_status,
         cancellation_resolution,
         payment_status
  into v_group_refund_status,
       v_group_resolution,
       v_group_payment_status
  from public.booking_groups
  where id = new.booking_group_id;

  if (
    v_group_refund_status in ('processing', 'review_required', 'refunded')
    or (
      v_group_resolution = 'approved'
      and v_group_payment_status in ('paid', 'refunded')
    )
  ) then
    if new.status = 'cancelled' then
      return new;
    end if;

    raise exception 'KLYX_GROUP_REFUND_TRACKING_CONFLICT'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists klyx_group_refund_booking_transition_2026
  on public.bookings;

create trigger klyx_group_refund_booking_transition_2026
before update of status,
                 service_status,
                 provider_finished_at,
                 client_confirmed_at
on public.bookings
for each row
execute function public.klyx_guard_group_refund_booking_transition_2026();

-- Once Stripe reconciliation proves the full grouped refund, finalize the child
-- financial/lifecycle snapshots and the refund audit in that same transaction.
-- This also prevents the route's post-Stripe error handler from downgrading an
-- already-terminal refund to failed.
create or replace function public.klyx_finalize_group_refund_terminal_2026()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_actor_profile_id uuid;
  v_refunded_at timestamptz;
begin
  if old.refund_status = 'refunded' then
    new.refund_status := 'refunded';
    new.payment_status := 'refunded';
    new.status := 'cancelled';
    new.stripe_refund_id := old.stripe_refund_id;
    new.refunded_amount_cents := old.refunded_amount_cents;
    new.refunded_at := old.refunded_at;
    return new;
  end if;

  if new.refund_status <> 'refunded' then
    return new;
  end if;

  if new.payment_status <> 'refunded'
     or new.status <> 'cancelled'
     or new.stripe_refund_id is null
     or coalesce(new.refunded_amount_cents, 0) <> new.total_amount_cents
     or coalesce(new.total_amount_cents, 0) <= 0 then
    raise exception 'KLYX_GROUP_REFUND_TERMINAL_PROOF_INVALID'
      using errcode = 'P0001';
  end if;

  v_actor_profile_id := coalesce(
    new.cancellation_resolved_by,
    new.client_profile_id
  );
  v_refunded_at := coalesce(new.refunded_at, now());
  new.refunded_at := v_refunded_at;

  update public.bookings
  set status = 'cancelled',
      service_status = 'cancelled',
      payment_status = 'refunded',
      refund_status = 'succeeded',
      stripe_refund_id = new.stripe_refund_id,
      refunded_amount_cents = greatest(coalesce(amount_total, 0), 0),
      refunded_at = v_refunded_at,
      updated_at = now()
  where booking_group_id = new.id
    and payment_status is distinct from 'refunded';

  insert into public.booking_group_cancellation_events (
    booking_group_id,
    actor_profile_id,
    actor_role,
    action,
    reason,
    stripe_refund_id
  )
  values (
    new.id,
    v_actor_profile_id,
    'system',
    'refund_succeeded',
    'Remboursement Stripe groupe cumule confirme.',
    new.stripe_refund_id
  )
  on conflict (booking_group_id, action, stripe_refund_id)
  do nothing;

  return new;
end;
$$;

drop trigger if exists klyx_finalize_group_refund_terminal_2026
  on public.booking_groups;

create trigger klyx_finalize_group_refund_terminal_2026
before update of refund_status,
                 payment_status,
                 status,
                 stripe_refund_id,
                 refunded_amount_cents,
                 refunded_at
on public.booking_groups
for each row
execute function public.klyx_finalize_group_refund_terminal_2026();

comment on function public.klyx_guard_group_refund_claim_2026() is
  'Locks child bookings and rejects a stale grouped refund claim after mission progress has started.';
comment on function public.klyx_guard_group_refund_booking_transition_2026() is
  'Blocks grouped mission tracking once an approved paid refund is processing/review/terminal.';
comment on function public.klyx_finalize_group_refund_terminal_2026() is
  'Keeps grouped refund terminal state monotone and atomically finalizes child snapshots plus Stripe refund audit.';

commit;
