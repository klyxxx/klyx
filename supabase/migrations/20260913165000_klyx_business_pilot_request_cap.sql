begin;

-- KLYX_BUSINESS_PILOT_REQUEST_CAP_20260913
-- Keep the first local pilot at <= 20 real requests even under concurrent intake.

create or replace function public.klyx_guard_business_pilot_request_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  if new.pilot_key <> 'brussels-anneessens-furniture-assembly-v1' then
    return new;
  end if;

  -- Serialize enrollment decisions for this pilot. The lock lasts until the
  -- surrounding insert transaction commits or rolls back.
  perform pg_advisory_xact_lock(hashtextextended(new.pilot_key, 0));

  -- Let the existing unique constraint handle idempotent duplicate inserts.
  if exists (
    select 1
    from public.business_pilot_requests
    where pilot_key = new.pilot_key
      and market_request_id = new.market_request_id
  ) then
    return new;
  end if;

  select count(*)::integer
  into current_count
  from public.business_pilot_requests
  where pilot_key = new.pilot_key;

  if current_count >= 20 then
    raise exception using
      errcode = '23514',
      message = 'KLYX_BUSINESS_PILOT_REQUEST_CAP_REACHED';
  end if;

  return new;
end;
$$;

revoke all on function public.klyx_guard_business_pilot_request_cap()
  from public, anon, authenticated;
grant execute on function public.klyx_guard_business_pilot_request_cap()
  to service_role;

drop trigger if exists klyx_business_pilot_request_cap_guard
  on public.business_pilot_requests;

create trigger klyx_business_pilot_request_cap_guard
before insert on public.business_pilot_requests
for each row
execute function public.klyx_guard_business_pilot_request_cap();

commit;
