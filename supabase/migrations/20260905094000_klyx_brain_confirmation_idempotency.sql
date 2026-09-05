-- KLYX_BRAIN_CONFIRMATION_IDEMPOTENCY_2026_09_05
-- A confirmation proof is unique for one conversation + normalized request snapshot.
-- Legacy messages remain valid because the fingerprint is nullable.

alter table public.brain_messages
  add column if not exists confirmation_fingerprint text;

create unique index if not exists brain_messages_confirmation_fingerprint_unique
  on public.brain_messages (conversation_id, confirmation_fingerprint)
  where role = 'user'
    and confirmation_fingerprint is not null
    and payload ->> 'action' = 'confirm_request';

comment on column public.brain_messages.confirmation_fingerprint is
  'Server-generated SHA-256 fingerprint used to make explicit KLYX request confirmations idempotent per conversation and normalized snapshot.';
