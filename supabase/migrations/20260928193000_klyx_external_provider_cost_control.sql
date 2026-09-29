-- KLYX external provider cost control
-- Fail-closed activation and budget reservation for metered providers.
-- No provider price is hard-coded: operations must configure audited estimates.

begin;

create table if not exists public.ops_external_provider_cost_controls (
  provider text primary key,
  mode text not null default 'disabled'
    check (mode in ('disabled', 'free', 'budgeted')),
  currency text null,
  period_budget_minor bigint null,
  estimated_cost_minor_per_call bigint null,
  period_started_at timestamptz null,
  period_ends_at timestamptz null,
  reserved_minor bigint not null default 0
    check (reserved_minor >= 0),
  approved_by text null,
  approved_at timestamptz null,
  approval_reference text null,
  updated_at timestamptz not null default now(),
  check (
    mode = 'disabled'
    or (
      approved_by is not null
      and length(trim(approved_by)) > 0
      and approved_at is not null
    )
  ),
  check (
    mode <> 'budgeted'
    or (
      currency ~ '^[A-Z]{3}$'
      and period_budget_minor is not null
      and period_budget_minor > 0
      and estimated_cost_minor_per_call is not null
      and estimated_cost_minor_per_call > 0
      and period_started_at is not null
      and period_ends_at is not null
      and period_started_at < period_ends_at
    )
  )
);

create table if not exists public.ops_external_provider_cost_events (
  id bigint generated always as identity primary key,
  provider text not null,
  operation text not null,
  idempotency_key text null,
  decision text not null check (decision in ('allowed', 'denied')),
  mode text not null check (mode in ('disabled', 'free', 'budgeted')),
  reason text not null,
  currency text null,
  estimated_cost_minor bigint not null default 0,
  reserved_minor_after bigint null,
  period_budget_minor bigint null,
  created_at timestamptz not null default now()
);

create unique index if not exists ops_external_provider_cost_events_idempotency_uq
  on public.ops_external_provider_cost_events(provider, operation, idempotency_key)
  where idempotency_key is not null;

create index if not exists ops_external_provider_cost_events_provider_created_idx
  on public.ops_external_provider_cost_events(provider, created_at desc);

alter table public.ops_external_provider_cost_controls enable row level security;
alter table public.ops_external_provider_cost_events enable row level security;

revoke all on public.ops_external_provider_cost_controls from public, anon, authenticated;
revoke all on public.ops_external_provider_cost_events from public, anon, authenticated;
grant all on public.ops_external_provider_cost_controls to service_role;
grant all on public.ops_external_provider_cost_events to service_role;

drop function if exists public.claim_external_provider_cost(text, text, text);

create function public.claim_external_provider_cost(
  p_provider text,
  p_operation text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_provider text := lower(trim(coalesce(p_provider, '')));
  v_operation text := trim(coalesce(p_operation, ''));
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_control public.ops_external_provider_cost_controls%rowtype;
  v_previous public.ops_external_provider_cost_events%rowtype;
  v_estimate bigint := 0;
  v_after bigint := 0;
  v_remaining bigint := null;
  v_reason text;
begin
  if v_provider = '' or v_operation = '' then
    raise exception 'KLYX_PROVIDER_COST_INVALID_INPUT';
  end if;

  if v_key is not null then
    select *
      into v_previous
      from public.ops_external_provider_cost_events
     where provider = v_provider
       and operation = v_operation
       and idempotency_key = v_key
     order by id desc
     limit 1;

    if found then
      return jsonb_build_object(
        'allowed', v_previous.decision = 'allowed',
        'provider', v_provider,
        'operation', v_operation,
        'mode', v_previous.mode,
        'reason', 'IDEMPOTENT_REPLAY:' || v_previous.reason,
        'currency', v_previous.currency,
        'reserved_minor', coalesce(v_previous.reserved_minor_after, 0),
        'remaining_minor', case
          when v_previous.period_budget_minor is null then null
          else greatest(v_previous.period_budget_minor - coalesce(v_previous.reserved_minor_after, 0), 0)
        end
      );
    end if;
  end if;

  select *
    into v_control
    from public.ops_external_provider_cost_controls
   where provider = v_provider
   for update;

  if not found then
    insert into public.ops_external_provider_cost_events (
      provider, operation, idempotency_key, decision, mode, reason
    ) values (
      v_provider, v_operation, v_key, 'denied', 'disabled', 'CONTROL_MISSING'
    );

    return jsonb_build_object(
      'allowed', false,
      'provider', v_provider,
      'operation', v_operation,
      'mode', 'disabled',
      'reason', 'CONTROL_MISSING',
      'currency', null,
      'reserved_minor', 0,
      'remaining_minor', null
    );
  end if;

  if v_control.mode = 'disabled' then
    insert into public.ops_external_provider_cost_events (
      provider, operation, idempotency_key, decision, mode, reason,
      currency, reserved_minor_after, period_budget_minor
    ) values (
      v_provider, v_operation, v_key, 'denied', 'disabled', 'PROVIDER_DISABLED',
      v_control.currency, v_control.reserved_minor, v_control.period_budget_minor
    );

    return jsonb_build_object(
      'allowed', false,
      'provider', v_provider,
      'operation', v_operation,
      'mode', 'disabled',
      'reason', 'PROVIDER_DISABLED',
      'currency', v_control.currency,
      'reserved_minor', v_control.reserved_minor,
      'remaining_minor', null
    );
  end if;

  if v_control.mode = 'free' then
    insert into public.ops_external_provider_cost_events (
      provider, operation, idempotency_key, decision, mode, reason,
      currency, estimated_cost_minor, reserved_minor_after, period_budget_minor
    ) values (
      v_provider, v_operation, v_key, 'allowed', 'free', 'APPROVED_FREE_TIER',
      v_control.currency, 0, v_control.reserved_minor, v_control.period_budget_minor
    );

    return jsonb_build_object(
      'allowed', true,
      'provider', v_provider,
      'operation', v_operation,
      'mode', 'free',
      'reason', 'APPROVED_FREE_TIER',
      'currency', v_control.currency,
      'reserved_minor', v_control.reserved_minor,
      'remaining_minor', null
    );
  end if;

  if now() < v_control.period_started_at or now() >= v_control.period_ends_at then
    v_reason := 'BUDGET_PERIOD_INACTIVE';
  elsif v_control.estimated_cost_minor_per_call is null
     or v_control.estimated_cost_minor_per_call <= 0 then
    v_reason := 'COST_ESTIMATE_MISSING';
  elsif v_control.period_budget_minor is null
     or v_control.period_budget_minor <= 0 then
    v_reason := 'BUDGET_MISSING';
  else
    v_estimate := v_control.estimated_cost_minor_per_call;
    v_after := v_control.reserved_minor + v_estimate;

    if v_after > v_control.period_budget_minor then
      v_reason := 'BUDGET_EXCEEDED';
    else
      update public.ops_external_provider_cost_controls
         set reserved_minor = v_after,
             updated_at = now()
       where provider = v_provider;

      v_remaining := v_control.period_budget_minor - v_after;

      insert into public.ops_external_provider_cost_events (
        provider, operation, idempotency_key, decision, mode, reason,
        currency, estimated_cost_minor, reserved_minor_after, period_budget_minor
      ) values (
        v_provider, v_operation, v_key, 'allowed', 'budgeted', 'BUDGET_RESERVED',
        v_control.currency, v_estimate, v_after, v_control.period_budget_minor
      );

      return jsonb_build_object(
        'allowed', true,
        'provider', v_provider,
        'operation', v_operation,
        'mode', 'budgeted',
        'reason', 'BUDGET_RESERVED',
        'currency', v_control.currency,
        'reserved_minor', v_after,
        'remaining_minor', v_remaining
      );
    end if;
  end if;

  insert into public.ops_external_provider_cost_events (
    provider, operation, idempotency_key, decision, mode, reason,
    currency, estimated_cost_minor, reserved_minor_after, period_budget_minor
  ) values (
    v_provider, v_operation, v_key, 'denied', 'budgeted', v_reason,
    v_control.currency, coalesce(v_control.estimated_cost_minor_per_call, 0),
    v_control.reserved_minor, v_control.period_budget_minor
  );

  return jsonb_build_object(
    'allowed', false,
    'provider', v_provider,
    'operation', v_operation,
    'mode', 'budgeted',
    'reason', v_reason,
    'currency', v_control.currency,
    'reserved_minor', v_control.reserved_minor,
    'remaining_minor', case
      when v_control.period_budget_minor is null then null
      else greatest(v_control.period_budget_minor - v_control.reserved_minor, 0)
    end
  );
end;
$function$;

revoke all on function public.claim_external_provider_cost(text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_external_provider_cost(text, text, text)
  to service_role;

-- Explicit default-deny rows. They do not activate any provider.
insert into public.ops_external_provider_cost_controls (provider, mode)
values
  ('openai', 'disabled'),
  ('sumsub', 'disabled'),
  ('twilio', 'disabled'),
  ('resend', 'disabled')
on conflict (provider) do nothing;

commit;
