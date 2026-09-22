-- KLYX canonical Stripe Connect identity manual resolution
-- Adds an explicit, append-only, account-level conflict-resolution authority.
-- Legacy profiles.stripe_account_id remains historical evidence only.

begin;

alter table public.account_stripe_connect_identities
  add column if not exists manually_resolved boolean not null default false,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by_user_id uuid,
  add column if not exists resolution_reason_code text,
  add column if not exists resolution_evidence jsonb not null default '{}'::jsonb;

create table if not exists public.account_stripe_connect_identity_events (
  id bigint generated always as identity primary key,
  account_id uuid not null
    references public.accounts(id)
    on delete cascade,
  event_type text not null,
  previous_identity_state text not null,
  previous_stripe_account_id text,
  selected_stripe_account_id text not null,
  previous_conflicting_stripe_account_ids text[] not null default '{}'::text[],
  operator_user_id uuid,
  operator_ref text not null,
  reason_code text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint account_stripe_connect_identity_events_type_check
    check (event_type in ('manual_resolution')),
  constraint account_stripe_connect_identity_events_state_check
    check (previous_identity_state in ('linked', 'conflict')),
  constraint account_stripe_connect_identity_events_operator_ref_check
    check (length(trim(operator_ref)) between 3 and 160),
  constraint account_stripe_connect_identity_events_reason_check
    check (reason_code ~ '^[A-Z0-9_.:-]{3,120}$')
);

alter table public.account_stripe_connect_identity_events enable row level security;

revoke all privileges on table public.account_stripe_connect_identity_events
  from public, anon, authenticated;
grant select, insert on table public.account_stripe_connect_identity_events
  to service_role;

create or replace function public.klyx_reject_stripe_connect_identity_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'KLYX_STRIPE_CONNECT_IDENTITY_EVENT_IMMUTABLE';
end;
$$;

drop trigger if exists account_stripe_connect_identity_events_immutable
  on public.account_stripe_connect_identity_events;

create trigger account_stripe_connect_identity_events_immutable
before update or delete
on public.account_stripe_connect_identity_events
for each row
execute function public.klyx_reject_stripe_connect_identity_event_mutation();

create or replace function public.klyx_resolve_account_stripe_connect_identity(
  p_account_id uuid,
  p_selected_stripe_account_id text,
  p_operator_user_id uuid,
  p_operator_ref text,
  p_reason_code text,
  p_evidence jsonb default '{}'::jsonb
)
returns table (
  account_id uuid,
  stripe_account_id text,
  identity_state text,
  manually_resolved boolean,
  resolved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.account_stripe_connect_identities%rowtype;
  v_selected text := trim(coalesce(p_selected_stripe_account_id, ''));
  v_operator_ref text := trim(coalesce(p_operator_ref, ''));
  v_reason text := upper(trim(coalesce(p_reason_code, '')));
begin
  if p_account_id is null then
    raise exception 'KLYX_STRIPE_CONNECT_RESOLUTION_ACCOUNT_REQUIRED';
  end if;

  if v_selected !~ '^acct_[A-Za-z0-9]+$' then
    raise exception 'KLYX_STRIPE_CONNECT_RESOLUTION_ACCOUNT_INVALID';
  end if;

  if length(v_operator_ref) < 3 or length(v_operator_ref) > 160 then
    raise exception 'KLYX_STRIPE_CONNECT_RESOLUTION_OPERATOR_INVALID';
  end if;

  if v_reason !~ '^[A-Z0-9_.:-]{3,120}$' then
    raise exception 'KLYX_STRIPE_CONNECT_RESOLUTION_REASON_INVALID';
  end if;

  select *
    into v_row
  from public.account_stripe_connect_identities
  where account_stripe_connect_identities.account_id = p_account_id
  for update;

  if not found then
    raise exception 'KLYX_STRIPE_CONNECT_RESOLUTION_IDENTITY_MISSING';
  end if;

  if v_row.identity_state <> 'conflict' then
    raise exception 'KLYX_STRIPE_CONNECT_RESOLUTION_CONFLICT_REQUIRED';
  end if;

  if not (v_selected = any(v_row.conflicting_stripe_account_ids)) then
    raise exception 'KLYX_STRIPE_CONNECT_RESOLUTION_SELECTION_NOT_IN_CONFLICT';
  end if;

  if exists (
    select 1
    from public.account_stripe_connect_identities other
    where other.account_id <> p_account_id
      and other.stripe_account_id = v_selected
  ) then
    raise exception 'KLYX_STRIPE_CONNECT_RESOLUTION_ACCOUNT_ALREADY_OWNED';
  end if;

  insert into public.account_stripe_connect_identity_events (
    account_id,
    event_type,
    previous_identity_state,
    previous_stripe_account_id,
    selected_stripe_account_id,
    previous_conflicting_stripe_account_ids,
    operator_user_id,
    operator_ref,
    reason_code,
    evidence
  )
  values (
    p_account_id,
    'manual_resolution',
    v_row.identity_state,
    v_row.stripe_account_id,
    v_selected,
    v_row.conflicting_stripe_account_ids,
    p_operator_user_id,
    v_operator_ref,
    v_reason,
    coalesce(p_evidence, '{}'::jsonb)
  );

  update public.account_stripe_connect_identities
  set
    stripe_account_id = v_selected,
    identity_state = 'linked',
    conflicting_stripe_account_ids = '{}'::text[],
    manually_resolved = true,
    resolved_at = now(),
    resolved_by_user_id = p_operator_user_id,
    resolution_reason_code = v_reason,
    resolution_evidence = coalesce(p_evidence, '{}'::jsonb),
    updated_at = now()
  where account_stripe_connect_identities.account_id = p_account_id;

  return query
  select
    identity.account_id,
    identity.stripe_account_id,
    identity.identity_state,
    identity.manually_resolved,
    identity.resolved_at
  from public.account_stripe_connect_identities identity
  where identity.account_id = p_account_id;
end;
$$;

revoke all on function public.klyx_resolve_account_stripe_connect_identity(
  uuid, text, uuid, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.klyx_resolve_account_stripe_connect_identity(
  uuid, text, uuid, text, text, jsonb
) to service_role;

comment on column public.account_stripe_connect_identities.manually_resolved is
  'True only after an explicit audited account-level conflict resolution. Legacy profile Stripe ids cannot override this canonical decision.';
comment on table public.account_stripe_connect_identity_events is
  'Append-only journal for account-level Stripe Connect identity conflict resolution.';

commit;
