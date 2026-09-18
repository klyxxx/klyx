-- KLYX PLATFORM-HELD BOOKING GUARDS — SINGLE + GROUP CHILDREN
--
-- Single bookings keep booking_settlements as authority.
-- Group children derive frozen child economics from booking_group_settlements
-- and never require a child PaymentIntent or child booking_settlements row.

begin;

create or replace function public.klyx_guard_platform_held_booking_economics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_single public.booking_settlements%rowtype;
  v_group public.booking_group_settlements%rowtype;
  v_last_position integer;
  v_prior_fee bigint := 0;
  v_fee integer;
begin
  if new.payment_mode <> 'platform_held' or new.payment_status <> 'paid' then
    return new;
  end if;

  if new.booking_group_id is null then
    select *
      into v_single
      from public.booking_settlements
     where booking_id = new.id;

    if not found then
      raise exception 'KLYX_PLATFORM_HELD_SETTLEMENT_MISSING';
    end if;

    if coalesce(trim(new.stripe_payment_intent_id), '') !~ '^pi_[A-Za-z0-9_]+$' then
      raise exception 'KLYX_PLATFORM_HELD_PAYMENT_INTENT_REQUIRED';
    end if;

    new.amount_total := v_single.gross_amount_cents;
    new.currency := v_single.currency;
    new.application_fee_amount := v_single.platform_fee_cents;
    new.platform_fee_amount := v_single.platform_fee_cents;
    new.provider_amount := v_single.provider_amount_cents;
    return new;
  end if;

  select *
    into v_group
    from public.booking_group_settlements
   where booking_group_id = new.booking_group_id;

  if not found then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_CHILD_SETTLEMENT_MISSING';
  end if;

  if coalesce(new.amount_total, 0) <= 0
     or v_group.gross_amount_cents <= 0
     or v_group.platform_fee_cents < 0
     or v_group.provider_amount_cents < 0
     or v_group.platform_fee_cents + v_group.provider_amount_cents <> v_group.gross_amount_cents then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_CHILD_ECONOMICS_INVALID';
  end if;

  if (
    select coalesce(sum(coalesce(b.amount_total, 0)), 0)
      from public.bookings b
     where b.booking_group_id = new.booking_group_id
  ) <> v_group.gross_amount_cents then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_CHILD_GROSS_MISMATCH';
  end if;

  select max(b.group_position)
    into v_last_position
    from public.bookings b
   where b.booking_group_id = new.booking_group_id;

  if new.group_position is null or v_last_position is null then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_CHILD_POSITION_MISSING';
  end if;

  if new.group_position = v_last_position then
    select coalesce(
      sum(
        floor(
          v_group.platform_fee_cents::numeric *
          coalesce(b.amount_total, 0)::numeric /
          v_group.gross_amount_cents::numeric
        )
      ),
      0
    )::bigint
    into v_prior_fee
    from public.bookings b
    where b.booking_group_id = new.booking_group_id
      and b.group_position <> v_last_position;

    v_fee := v_group.platform_fee_cents - v_prior_fee::integer;
  else
    v_fee := floor(
      v_group.platform_fee_cents::numeric *
      coalesce(new.amount_total, 0)::numeric /
      v_group.gross_amount_cents::numeric
    )::integer;
  end if;

  if v_fee < 0 or v_fee > coalesce(new.amount_total, 0) then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_CHILD_FEE_INVALID';
  end if;

  new.currency := v_group.currency;
  new.application_fee_amount := v_fee;
  new.platform_fee_amount := v_fee;
  new.provider_amount := new.amount_total - v_fee;

  return new;
end;
$$;

create or replace function public.klyx_mark_platform_held_booking_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if new.payment_mode <> 'platform_held'
     or new.payment_status <> 'paid'
     or old.payment_status = 'paid' then
    return new;
  end if;

  -- Parent booking_group_settlements owns the grouped payment state.
  if new.booking_group_id is not null then
    return new;
  end if;

  update public.booking_settlements
     set state = case
           when state = 'pending_payment' then 'held'
           else state
         end,
         stripe_checkout_session_id = coalesce(stripe_checkout_session_id, new.stripe_checkout_session_id),
         stripe_payment_intent_id = coalesce(stripe_payment_intent_id, new.stripe_payment_intent_id),
         updated_at = now()
   where booking_id = new.id
     and state in ('pending_payment', 'held');

  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    raise exception 'KLYX_PLATFORM_HELD_PAID_SETTLEMENT_NOT_WRITABLE';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_platform_held_economics_guard
  on public.bookings;
create trigger bookings_platform_held_economics_guard
before update on public.bookings
for each row execute function public.klyx_guard_platform_held_booking_economics();

drop trigger if exists bookings_platform_held_paid_reconcile
  on public.bookings;
create trigger bookings_platform_held_paid_reconcile
after update on public.bookings
for each row execute function public.klyx_mark_platform_held_booking_paid();

revoke all on function public.klyx_guard_platform_held_booking_economics()
  from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_booking_paid()
  from public, anon, authenticated;

comment on function public.klyx_guard_platform_held_booking_economics() is
  'Keeps single booking_settlements authority and derives group-child economics from one frozen booking_group_settlements parent.';

comment on function public.klyx_mark_platform_held_booking_paid() is
  'Transitions single settlements on paid booking; group children defer settlement state to booking_groups parent trigger.';

commit;
