-- Mutual exclusion between legacy multi-checkout split payments and
-- Platform-Held single-charge group settlement.
begin;

create or replace function
public.klyx_guard_platform_held_group_legacy_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
      from public.split_booking_payment_runs r
     where r.batch_id = new.batch_id
  ) then
    raise exception 'KLYX_GROUP_SETTLEMENT_LEGACY_PAYMENT_ALREADY_STARTED';
  end if;

  update public.split_booking_payment_confirmations
     set consumed_at = coalesce(consumed_at, now()),
         updated_at = now()
   where id = new.payment_confirmation_id
     and batch_id = new.batch_id
     and invalidated_at is null
     and (consumed_at is null or consumed_at = consumed_at);

  if not found then
    raise exception 'KLYX_GROUP_SETTLEMENT_CONFIRMATION_NOT_CONSUMABLE';
  end if;

  return new;
end;
$$;

drop trigger if exists
  klyx_guard_platform_held_group_legacy_overlap
on public.platform_held_group_settlements;

create trigger
  klyx_guard_platform_held_group_legacy_overlap
before insert
on public.platform_held_group_settlements
for each row
execute function public.klyx_guard_platform_held_group_legacy_overlap();

create or replace function
public.klyx_guard_legacy_split_platform_held_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
      from public.platform_held_group_settlements s
     where s.batch_id = new.batch_id
  ) then
    raise exception 'KLYX_GROUP_SETTLEMENT_PLATFORM_HELD_ALREADY_STARTED';
  end if;

  return new;
end;
$$;

drop trigger if exists
  klyx_guard_legacy_split_platform_held_overlap
on public.split_booking_payment_runs;

create trigger
  klyx_guard_legacy_split_platform_held_overlap
before insert
on public.split_booking_payment_runs
for each row
execute function public.klyx_guard_legacy_split_platform_held_overlap();

revoke all on function public.klyx_guard_platform_held_group_legacy_overlap()
  from public, anon, authenticated;
revoke all on function public.klyx_guard_legacy_split_platform_held_overlap()
  from public, anon, authenticated;

grant execute on function public.klyx_guard_platform_held_group_legacy_overlap()
  to service_role;
grant execute on function public.klyx_guard_legacy_split_platform_held_overlap()
  to service_role;

commit;
