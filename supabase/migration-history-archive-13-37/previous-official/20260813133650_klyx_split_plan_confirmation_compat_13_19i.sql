-- KLYX_SPLIT_PLAN_CONFIRMATION_DB_COMPAT_13_19I

create table if not exists public.market_split_plan_confirmations (
  id uuid primary key default gen_random_uuid(),

  market_request_id uuid not null
    references public.market_service_requests(id)
    on delete cascade,

  client_profile_id uuid not null
    references public.profiles(id)
    on delete cascade,

  plan_hash text not null,

  plan_snapshot jsonb not null,

  slot_count integer not null,

  provider_count integer not null,

  confirmed_at timestamptz not null
    default now(),

  invalidated_at timestamptz,

  invalidation_reason text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint klyx_split_plan_slot_count_13_19i
    check (slot_count >= 2),

  constraint klyx_split_plan_provider_count_13_19i
    check (provider_count >= 2),

  constraint klyx_split_plan_hash_13_19i
    check (char_length(plan_hash) = 64)
);

create index if not exists
  klyx_split_plan_confirmation_request_13_19i
on public.market_split_plan_confirmations (
  market_request_id,
  confirmed_at desc
);

create unique index if not exists
  klyx_split_plan_confirmation_one_active_13_19i
on public.market_split_plan_confirmations (
  market_request_id
)
where invalidated_at is null;

alter table
  public.market_split_plan_confirmations
enable row level security;


create or replace function
  public.klyx_confirm_split_plan_13_18(
    p_request_id uuid,
    p_client_profile_id uuid,
    p_plan_hash text,
    p_plan_snapshot jsonb,
    p_slot_count integer,
    p_provider_count integer
  )
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_confirmation_id uuid;
begin
  select client_profile_id
  into v_owner
  from public.market_service_requests
  where id = p_request_id;

  if v_owner is null then
    raise exception
      'KLYX_SPLIT_PLAN_REQUEST_NOT_FOUND';
  end if;

  if v_owner <> p_client_profile_id then
    raise exception
      'KLYX_SPLIT_PLAN_OWNER_REQUIRED';
  end if;

  if p_slot_count < 2 then
    raise exception
      'KLYX_SPLIT_PLAN_INVALID_SLOT_COUNT';
  end if;

  if p_provider_count < 2 then
    raise exception
      'KLYX_SPLIT_PLAN_INVALID_PROVIDER_COUNT';
  end if;

  if
    p_plan_hash is null
    or length(p_plan_hash) <> 64
  then
    raise exception
      'KLYX_SPLIT_PLAN_INVALID_HASH';
  end if;

  update public.market_split_plan_confirmations
  set
    invalidated_at = now(),
    invalidation_reason = 'replaced_by_new_confirmation',
    updated_at = now()
  where
    market_request_id = p_request_id
    and invalidated_at is null;

  insert into public.market_split_plan_confirmations (
    market_request_id,
    client_profile_id,
    plan_hash,
    plan_snapshot,
    slot_count,
    provider_count
  )
  values (
    p_request_id,
    p_client_profile_id,
    p_plan_hash,
    p_plan_snapshot,
    p_slot_count,
    p_provider_count
  )
  returning id
  into v_confirmation_id;

  return v_confirmation_id;
end;
$$;

revoke all
on function public.klyx_confirm_split_plan_13_18(
  uuid,
  uuid,
  text,
  jsonb,
  integer,
  integer
)
from public;

revoke all
on function public.klyx_confirm_split_plan_13_18(
  uuid,
  uuid,
  text,
  jsonb,
  integer,
  integer
)
from authenticated;

grant execute
on function public.klyx_confirm_split_plan_13_18(
  uuid,
  uuid,
  text,
  jsonb,
  integer,
  integer
)
to service_role;