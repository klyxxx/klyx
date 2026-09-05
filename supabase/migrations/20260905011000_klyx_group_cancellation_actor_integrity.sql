-- KLYX group cancellation actor integrity hardening
--
-- booking_groups is mutated through server-side service_role routes, so RLS
-- cannot be the final authorization boundary for cancellation state. Keep the
-- participant/self-approval invariants in PostgreSQL as well.

begin;

create or replace function public.klyx_guard_group_cancellation_actor_integrity()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  expected_role text;
begin
  if new.cancellation_request_status = 'requested' then
    if new.cancellation_requested_by is null then
      raise exception 'KLYX_GROUP_CANCEL_REQUESTER_REQUIRED';
    end if;

    if new.cancellation_requested_by = new.client_profile_id then
      expected_role := 'client';
    elsif new.cancellation_requested_by = new.provider_profile_id then
      expected_role := 'provider';
    else
      raise exception 'KLYX_GROUP_CANCEL_REQUESTER_NOT_PARTICIPANT';
    end if;

    if new.cancellation_requested_role is distinct from expected_role then
      raise exception 'KLYX_GROUP_CANCEL_REQUESTER_ROLE_MISMATCH';
    end if;

    -- A second concurrent request must never replace the participant who
    -- already owns the pending request. PostgreSQL row locking makes this
    -- check observe the latest committed row after a concurrent update waits.
    if
      old.cancellation_request_status = 'requested'
      and old.cancellation_requested_by is not null
      and new.cancellation_requested_by is distinct from old.cancellation_requested_by
    then
      raise exception 'KLYX_GROUP_CANCEL_REQUEST_ALREADY_OWNED';
    end if;
  end if;

  if
    new.cancellation_request_status = 'withdrawn'
    and old.cancellation_request_status = 'requested'
    and new.cancellation_requested_by is distinct from old.cancellation_requested_by
  then
    raise exception 'KLYX_GROUP_CANCEL_WITHDRAW_REQUESTER_CHANGED';
  end if;

  if new.cancellation_resolved_by is not null then
    if
      new.cancellation_resolved_by <> new.client_profile_id
      and new.cancellation_resolved_by <> new.provider_profile_id
    then
      raise exception 'KLYX_GROUP_CANCEL_RESOLVER_NOT_PARTICIPANT';
    end if;

    if new.cancellation_resolved_by = new.cancellation_requested_by then
      raise exception 'KLYX_GROUP_CANCEL_SELF_APPROVAL';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.klyx_guard_group_cancellation_actor_integrity()
  from public, anon, authenticated;

drop trigger if exists klyx_group_cancellation_actor_integrity
  on public.booking_groups;

create trigger klyx_group_cancellation_actor_integrity
before update of
  cancellation_request_status,
  cancellation_requested_by,
  cancellation_requested_role,
  cancellation_resolved_by
on public.booking_groups
for each row
execute function public.klyx_guard_group_cancellation_actor_integrity();

comment on function public.klyx_guard_group_cancellation_actor_integrity() is
  'Enforces participant ownership, requester stability and no self-approval for booking-group cancellation mutations, including service_role writes.';

commit;
