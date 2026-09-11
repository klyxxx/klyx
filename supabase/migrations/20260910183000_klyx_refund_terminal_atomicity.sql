begin;

-- KLYX_REFUND_TERMINAL_ATOMICITY_17_02
--
-- Audit métier 3: Payment -> refund.
-- Financial truth must remain monotone under route/webhook races, and a grouped
-- refund may not commit its terminal group row without its child snapshots and
-- immutable audit fact in the same PostgreSQL transaction.

-- ---------------------------------------------------------------------------
-- 1. Repair any historical single/group-child row whose terminal payment fact
--    survived a stale post-Stripe writer that downgraded only refund_status.
-- ---------------------------------------------------------------------------

update public.bookings
set
  refund_status = 'succeeded',
  refunded_amount_cents = greatest(
    coalesce(refunded_amount_cents, 0),
    coalesce(amount_total, 0)
  ),
  refunded_at = coalesce(refunded_at, updated_at, paid_at, now()),
  updated_at = now()
where payment_status = 'refunded'
  and refund_status is distinct from 'succeeded';

-- ---------------------------------------------------------------------------
-- 2. Extend the canonical paid/refunded booking guard. A stale route response
--    is allowed to finish harmlessly, but it can never overwrite terminal
--    refund proof already committed by a signed Stripe webhook.
-- ---------------------------------------------------------------------------

create or replace function public.klyx_protect_paid_booking()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  full_refund_proven boolean;
begin
  if old.payment_status = 'refunded' then
    if new.payment_status is distinct from 'refunded' then
      raise exception 'KLYX_BOOKING_ALREADY_REFUNDED';
    end if;

    -- Preserve the exact terminal Stripe proof. This intentionally absorbs a
    -- stale processing/failed snapshot written after refund.updated succeeded.
    new.refund_status := old.refund_status;
    new.stripe_refund_id := old.stripe_refund_id;
    new.refunded_amount_cents := old.refunded_amount_cents;
    new.refunded_at := old.refunded_at;
  end if;

  full_refund_proven :=
    new.refund_status = 'succeeded'
    and coalesce(old.amount_total, 0) > 0
    and coalesce(new.refunded_amount_cents, 0) >= old.amount_total;

  if old.payment_status = 'paid' then
    if new.amount_total is distinct from old.amount_total
      or new.currency is distinct from old.currency
      or new.stripe_checkout_session_id is distinct from old.stripe_checkout_session_id
      or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
    then
      raise exception 'KLYX_PAID_BOOKING_IMMUTABLE';
    end if;

    if new.payment_status is distinct from 'paid' then
      if not (
        new.payment_status = 'refunded'
        and full_refund_proven
      ) then
        raise exception 'KLYX_BOOKING_ALREADY_PAID';
      end if;
    elsif full_refund_proven then
      new.payment_status := 'refunded';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.klyx_protect_paid_booking()
from public, anon, authenticated;
grant execute on function public.klyx_protect_paid_booking()
to service_role;

-- ---------------------------------------------------------------------------
-- 3. Group boundary. The group row is the serialization point for cancellation
--    approval/refund and child mission progress.
-- ---------------------------------------------------------------------------

create or replace function public.klyx_guard_booking_group_refund_17_02()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- A fully refunded group is financially terminal. Keep its terminal proof
  -- even if a stale HTTP catch/retry tries to write failed afterwards.
  if old.refund_status = 'refunded' then
    if new.payment_status is distinct from old.payment_status
       or new.status is distinct from old.status then
      raise exception 'KLYX_GROUP_ALREADY_REFUNDED';
    end if;

    new.refund_status := old.refund_status;
    new.stripe_refund_id := old.stripe_refund_id;
    new.refunded_amount_cents := old.refunded_amount_cents;
    new.refunded_at := old.refunded_at;
  end if;

  -- A partial succeeded Stripe fact must not be erased by the route catch.
  if old.refund_status = 'review_required'
     and coalesce(old.refunded_amount_cents, 0) > 0
     and new.refund_status = 'failed' then
    new.refund_status := old.refund_status;
    new.stripe_refund_id := old.stripe_refund_id;
    new.refunded_amount_cents := old.refunded_amount_cents;
    new.refunded_at := old.refunded_at;
  end if;

  -- Claiming a paid group refund and child progress serialize on this group row.
  -- Re-check the children inside the locked group UPDATE so the earlier HTTP
  -- preflight can never become stale before the Stripe side effect begins.
  if new.refund_status = 'processing'
     and old.refund_status is distinct from 'processing' then
    if new.payment_status is distinct from 'paid' then
      raise exception 'KLYX_GROUP_REFUND_REQUIRES_PAID';
    end if;

    if exists (
      select 1
      from public.bookings child
      where child.booking_group_id = old.id
        and (
          child.status = 'completed'
          or child.provider_finished_at is not null
          or coalesce(child.service_status, '') in (
            'en_route',
            'arrived',
            'in_progress',
            'completed'
          )
        )
    ) then
      raise exception 'KLYX_GROUP_REFUND_CHILD_ALREADY_STARTED';
    end if;
  end if;

  -- refund_status is the financial serialization fact. A lifecycle writer may
  -- not complete the group after the refund claim has won the parent-row lock.
  if new.status = 'completed'
     and new.status is distinct from old.status
     and (
       coalesce(old.refund_status, '') in ('processing', 'refunded')
       or coalesce(new.refund_status, '') in ('processing', 'refunded')
     ) then
    raise exception 'KLYX_GROUP_REFUND_STATUS_CONFLICT';
  end if;

  if new.refund_status = 'refunded'
     and old.refund_status is distinct from 'refunded' then
    if new.payment_status is distinct from 'refunded'
       or new.status is distinct from 'cancelled'
       or new.stripe_refund_id is null
       or coalesce(new.total_amount_cents, 0) <= 0
       or coalesce(new.refunded_amount_cents, 0) < new.total_amount_cents then
      raise exception 'KLYX_GROUP_REFUND_TERMINAL_PROOF_INVALID';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.klyx_guard_booking_group_refund_17_02()
from public, anon, authenticated;
grant execute on function public.klyx_guard_booking_group_refund_17_02()
to service_role;

drop trigger if exists klyx_booking_group_refund_guard_17_02
on public.booking_groups;
create trigger klyx_booking_group_refund_guard_17_02
before update of status, payment_status, refund_status,
  stripe_refund_id, refunded_amount_cents, refunded_at
on public.booking_groups
for each row
execute function public.klyx_guard_booking_group_refund_17_02();

-- ---------------------------------------------------------------------------
-- 4. Child side of the same lock order. Any mission progression on a grouped
--    booking first locks its parent group. Cancellation/final refund writes are
--    still allowed so Stripe reconciliation can close the mission.
-- ---------------------------------------------------------------------------

create or replace function public.klyx_guard_group_child_refund_progress_17_02()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  group_refund_status text;
  progression boolean;
begin
  if new.booking_group_id is null then
    return new;
  end if;

  progression :=
    (
      new.status is distinct from old.status
      and new.status is distinct from 'cancelled'
    )
    or (
      new.service_status is distinct from old.service_status
      and new.service_status is distinct from 'cancelled'
    )
    or (
      new.provider_finished_at is distinct from old.provider_finished_at
      and new.status is distinct from 'cancelled'
    )
    or (
      new.client_confirmed_at is distinct from old.client_confirmed_at
      and new.status is distinct from 'cancelled'
    );

  if not progression then
    return new;
  end if;

  select parent.refund_status
  into group_refund_status
  from public.booking_groups parent
  where parent.id = new.booking_group_id
  for update;

  if found
     and coalesce(group_refund_status, '') in ('processing', 'refunded') then
    raise exception 'KLYX_GROUP_REFUND_CHILD_PROGRESS_CONFLICT';
  end if;

  return new;
end;
$$;

revoke all on function public.klyx_guard_group_child_refund_progress_17_02()
from public, anon, authenticated;
grant execute on function public.klyx_guard_group_child_refund_progress_17_02()
to service_role;

drop trigger if exists klyx_group_child_refund_progress_guard_17_02
on public.bookings;
create trigger klyx_group_child_refund_progress_guard_17_02
before update of status, service_status, provider_finished_at, client_confirmed_at
on public.bookings
for each row
when (new.booking_group_id is not null)
execute function public.klyx_guard_group_child_refund_progress_17_02();

-- ---------------------------------------------------------------------------
-- 5. Terminal group refund finalization is atomic with the group transition.
--    If any child/audit write fails, PostgreSQL rolls the group transition back,
--    so the signed Stripe webhook retry remains able to reconcile it again.
-- ---------------------------------------------------------------------------

create or replace function public.klyx_finalize_group_refund_17_02()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid;
begin
  -- The financial trigger does not depend on cancellation metadata. The client
  -- profile is sufficient attribution for the immutable system refund fact.
  actor_id := new.client_profile_id;

  insert into public.booking_status_events (
    booking_id,
    actor_id,
    previous_status,
    new_status,
    note
  )
  select
    child.id,
    actor_id,
    child.status,
    'cancelled',
    'Mission groupee annulee apres remboursement Stripe cumule confirme.'
  from public.bookings child
  where child.booking_group_id = new.id
    and child.status not in ('cancelled', 'rejected');

  update public.bookings child
  set
    status = 'cancelled',
    service_status = 'cancelled',
    payment_status = 'refunded',
    refund_status = 'succeeded',
    stripe_refund_id = new.stripe_refund_id,
    refunded_amount_cents = greatest(coalesce(child.amount_total, 0), 0),
    refunded_at = coalesce(new.refunded_at, now()),
    updated_at = now()
  where child.booking_group_id = new.id
    and child.payment_status is distinct from 'refunded';

  insert into public.booking_group_cancellation_events (
    booking_group_id,
    actor_profile_id,
    actor_role,
    action,
    reason,
    stripe_refund_id
  ) values (
    new.id,
    actor_id,
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

revoke all on function public.klyx_finalize_group_refund_17_02()
from public, anon, authenticated;
grant execute on function public.klyx_finalize_group_refund_17_02()
to service_role;

drop trigger if exists klyx_finalize_group_refund_17_02
on public.booking_groups;
create trigger klyx_finalize_group_refund_17_02
after update of refund_status
on public.booking_groups
for each row
when (
  new.refund_status = 'refunded'
  and old.refund_status is distinct from new.refund_status
)
execute function public.klyx_finalize_group_refund_17_02();

-- ---------------------------------------------------------------------------
-- 6. Idempotent repair for a terminal group row that may predate this migration.
-- ---------------------------------------------------------------------------

insert into public.booking_status_events (
  booking_id,
  actor_id,
  previous_status,
  new_status,
  note
)
select
  child.id,
  parent.client_profile_id,
  child.status,
  'cancelled',
  'Mission groupee annulee apres remboursement Stripe cumule confirme.'
from public.booking_groups parent
join public.bookings child
  on child.booking_group_id = parent.id
where parent.refund_status = 'refunded'
  and parent.payment_status = 'refunded'
  and child.status not in ('cancelled', 'rejected');

update public.bookings child
set
  status = 'cancelled',
  service_status = 'cancelled',
  payment_status = 'refunded',
  refund_status = 'succeeded',
  stripe_refund_id = parent.stripe_refund_id,
  refunded_amount_cents = greatest(coalesce(child.amount_total, 0), 0),
  refunded_at = coalesce(parent.refunded_at, now()),
  updated_at = now()
from public.booking_groups parent
where child.booking_group_id = parent.id
  and parent.refund_status = 'refunded'
  and parent.payment_status = 'refunded'
  and child.payment_status is distinct from 'refunded';

insert into public.booking_group_cancellation_events (
  booking_group_id,
  actor_profile_id,
  actor_role,
  action,
  reason,
  stripe_refund_id
)
select
  parent.id,
  parent.client_profile_id,
  'system',
  'refund_succeeded',
  'Remboursement Stripe groupe cumule confirme.',
  parent.stripe_refund_id
from public.booking_groups parent
where parent.refund_status = 'refunded'
  and parent.payment_status = 'refunded'
  and parent.stripe_refund_id is not null
on conflict (booking_group_id, action, stripe_refund_id)
do nothing;

comment on function public.klyx_guard_booking_group_refund_17_02() is
  'KLYX 17.02: serializes grouped cancellation/refund with mission completion and preserves terminal Stripe refund facts.';
comment on function public.klyx_guard_group_child_refund_progress_17_02() is
  'KLYX 17.02: locks the parent group before grouped child mission progress so a paid refund and completion cannot race.';
comment on function public.klyx_finalize_group_refund_17_02() is
  'KLYX 17.02: atomically finalizes grouped child refund snapshots and immutable audit when the group reaches refunded.';

commit;
