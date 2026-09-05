-- KLYX_ACTIVITY_HIDDEN_MISSIONS_2026_09_05
-- User-facing deletion removes a mission from Activity without destroying
-- booking/payment/refund/audit records that KLYX must retain.

create table if not exists public.activity_hidden_missions (
  id uuid primary key default gen_random_uuid(),
  client_profile_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('booking', 'group', 'split')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  unique (client_profile_id, entity_type, entity_id)
);

create index if not exists activity_hidden_missions_client_created_idx
  on public.activity_hidden_missions (client_profile_id, created_at desc);

alter table public.activity_hidden_missions enable row level security;

revoke all on table public.activity_hidden_missions from anon, authenticated;
grant select, insert, update, delete on table public.activity_hidden_missions to service_role;

comment on table public.activity_hidden_missions is
  'Server-only registry of missions a client removed from the Activity UI. Financial and audit source rows are retained.';
