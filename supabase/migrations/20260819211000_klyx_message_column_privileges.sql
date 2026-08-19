-- ============================================================
-- KLYX 12B.12T MESSAGE COLUMN PRIVILEGE HARDENING
--
-- Messages intentionally remain a direct authenticated + Realtime surface.
-- RLS restricts rows to booking participants, but historical table-wide ALL
-- privileges were broader than the UI needs. In particular, receivers only
-- need to update is_read and must not be able to rewrite message content,
-- booking/sender/receiver identity or timestamps on an existing row.
--
-- KLYX_MESSAGE_COLUMN_PRIVILEGES_12B_12T
-- ============================================================

begin;

revoke all privileges on table public.messages
  from public, anon, authenticated;

grant select on table public.messages
  to authenticated;
grant insert (booking_id, sender_id, receiver_id, message, is_read)
  on table public.messages
  to authenticated;
grant update (is_read)
  on table public.messages
  to authenticated;

grant all privileges on table public.messages
  to service_role;

-- This SECURITY DEFINER helper is needed by the authenticated INSERT RLS
-- policy, but anonymous callers have no legitimate reason to probe explicit
-- booking/profile participant combinations.
revoke all privileges on function
  public.klyx_valid_message_participants(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function
  public.klyx_valid_message_participants(uuid, uuid, uuid)
  to authenticated, service_role;

-- Existing klyx_messages_select/insert/update RLS remains authoritative for
-- row ownership. SELECT is retained for Supabase Realtime message delivery.

commit;
