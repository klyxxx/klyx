-- KLYX PLATFORM-HELD LEDGER GUARD — SINGLE + GROUP
--
-- Preserve the certified single-booking settlement guard while allowing
-- booking-group children to derive their ledger economics from the one frozen
-- booking_group_settlements row. The final child absorbs the cent remainder so
-- aggregate child ledger economics reconcile exactly to group captured truth.

begin;

create or replace function public.klyx_guard_platform_held_ledger_economics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_single public.booking_settlements%rowtype;
  v_group public.booking_group_settlements%rowtype;
  v_booking record;
  v_last_position integer;
  v_prior_fee bigint := 0;
  v_fee integer;
begin
  if new.entry_type <> 'payment_succeeded' then
    return new;
  end if;

  select
    b.payment_mode,
    b.booking_group_id,
    b.group_position,
    b.amount_total
  into v_booking
  from public.bookings b
  where b.id = new.booking_id;

  if not found or coalesce(v_booking.payment_mode, '') <> 'platform_held' then
    return new;
  end if;

  -- Certified single-booking path remains unchanged in authority.
  if v_booking.booking_group_id is null then
    select *
      into v_single
      from public.booking_settlements
     where booking_id = new.booking_id;

    if not found then
      raise exception 'KLYX_PLATFORM_HELD_LEDGER_SETTLEMENT_MISSING';
    end if;

    new.payment_mode := 'platform_held';
    new.currency := v_single.currency;
    new.gross_amount_cents := v_single.gross_amount_cents;
    new.platform_fee_cents := v_single.platform_fee_cents;
    new.provider_amount_cents := v_single.provider_amount_cents;
    return new;
  end if;

  -- Group children must resolve exclusively through the parent group settlement.
  select *
    into v_group
    from public.booking_group_settlements
   where booking_group_id = v_booking.booking_group_id;

  if not found then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_LEDGER_SETTLEMENT_MISSING';
  end if;

  if coalesce(v_booking.amount_total, 0) <= 0
     or v_group.gross_amount_cents <= 0
     or v_group.platform_fee_cents < 0
     or v_group.provider_amount_cents < 0
     or v_group.platform_fee_cents + v_group.provider_amount_cents <> v_group.gross_amount_cents then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_LEDGER_ECONOMICS_INVALID';
  end if;

  if (
    select coalesce(sum(coalesce(b.amount_total, 0)), 0)
      from public.bookings b
     where b.booking_group_id = v_booking.booking_group_id
  ) <> v_group.gross_amount_cents then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_LEDGER_GROSS_MISMATCH';
  end if;

  select max(b.group_position)
    into v_last_position
    from public.bookings b
   where b.booking_group_id = v_booking.booking_group_id;

  if v_booking.group_position is null or v_last_position is null then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_LEDGER_POSITION_MISSING';
  end if;

  if v_booking.group_position = v_last_position then
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
    where b.booking_group_id = v_booking.booking_group_id
      and b.group_position <> v_last_position;

    v_fee := v_group.platform_fee_cents - v_prior_fee::integer;
  else
    v_fee := floor(
      v_group.platform_fee_cents::numeric *
      coalesce(v_booking.amount_total, 0)::numeric /
      v_group.gross_amount_cents::numeric
    )::integer;
  end if;

  if v_fee < 0 or v_fee > coalesce(v_booking.amount_total, 0) then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_LEDGER_FEE_INVALID';
  end if;

  new.payment_mode := 'platform_held';
  new.currency := v_group.currency;
  new.gross_amount_cents := v_booking.amount_total;
  new.platform_fee_cents := v_fee;
  new.provider_amount_cents := v_booking.amount_total - v_fee;

  return new;
end;
$$;

drop trigger if exists booking_financial_ledger_platform_held_guard
  on public.booking_financial_ledger;

create trigger booking_financial_ledger_platform_held_guard
before insert or update on public.booking_financial_ledger
for each row
execute function public.klyx_guard_platform_held_ledger_economics();

revoke all on function public.klyx_guard_platform_held_ledger_economics()
  from public, anon, authenticated;

comment on function public.klyx_guard_platform_held_ledger_economics() is
  'Preserves single booking settlement ledger truth and derives grouped child ledger shares from one frozen group settlement with deterministic cent remainder.';

commit;
