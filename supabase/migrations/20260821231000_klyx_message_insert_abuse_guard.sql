-- KLYX direct-message insert abuse guard.
--
-- Messages intentionally remain a direct authenticated Supabase + Realtime
-- surface. Because a modified browser can bypass Next.js middleware, message
-- write limits must be enforced inside PostgreSQL itself.

begin;

-- Keep the UI's existing content boundary authoritative at the database layer
-- for all new rows without rewriting or invalidating historical messages.
alter table public.messages
  add constraint klyx_messages_nonblank_check
  check (char_length(btrim(message)) >= 1)
  not valid;

alter table public.messages
  add constraint klyx_messages_length_check
  check (char_length(message) <= 2000)
  not valid;

create or replace function public.klyx_enforce_message_insert_policy()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid;
  v_key_hash text;
  v_allowed boolean;
begin
  -- service_role / trusted SQL writers are not subject to a browser-user quota.
  -- The CHECK constraints above still protect the content invariant for them.
  v_actor_id := auth.uid();

  if v_actor_id is null then
    return new;
  end if;

  -- A sender cannot pre-mark a newly delivered message as read. Existing RLS
  -- and column privileges still reserve later is_read updates for the receiver.
  new.is_read := false;

  -- Match the application limiter's SHA-256 subject derivation exactly, while
  -- keeping raw auth/profile identifiers out of api_rate_limits.
  v_key_hash := encode(
    sha256(
      convert_to(
        'klyx-rate-limit:' || v_actor_id::text,
        'UTF8'
      )
    ),
    'hex'
  );

  select rate.allowed
  into v_allowed
  from public.klyx_consume_api_rate_limit(
    v_key_hash,
    'message_send',
    30,
    60
  ) as rate;

  if v_allowed is distinct from true then
    raise exception 'KLYX_MESSAGE_RATE_LIMITED'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.klyx_enforce_message_insert_policy()
  from public, anon, authenticated;
grant execute on function public.klyx_enforce_message_insert_policy()
  to service_role;

drop trigger if exists klyx_message_insert_abuse_guard on public.messages;
create trigger klyx_message_insert_abuse_guard
before insert on public.messages
for each row
execute function public.klyx_enforce_message_insert_policy();

comment on function public.klyx_enforce_message_insert_policy() is
  'DB-level authenticated message anti-abuse guard: 30 sends/minute per auth account; direct client bypass is not possible.';

commit;
