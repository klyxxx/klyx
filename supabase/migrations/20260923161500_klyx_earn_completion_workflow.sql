-- KLYX MISSION 19 — EARN COMPLETION STATE
--
-- The provider-side autonomous lifecycle must not jump directly from mission
-- execution to settlement. Completion is explicit persistent server state:
--
-- skill -> opportunities -> eligibility -> proposal -> acceptance
-- -> mission -> completion -> settlement -> completed
--
-- This migration changes orchestration state only. It performs no financial
-- side effect and does not authorize a Settlement by itself.

begin;

create or replace function public.klyx_transition_workflow(
  p_workflow_id uuid,
  p_account_id uuid,
  p_expected_version bigint,
  p_to_step text,
  p_event_type text,
  p_actor_type text,
  p_payload jsonb default '{}'::jsonb
)
returns table (
  workflow_id uuid,
  mode text,
  current_step text,
  status text,
  version bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workflow public.klyx_workflows%rowtype;
  v_allowed boolean := false;
  v_next_ordinal bigint;
begin
  if p_actor_type not in ('assistant', 'user', 'server', 'system', 'operator') then
    raise exception 'KLYX_WORKFLOW_ACTOR_INVALID';
  end if;

  select w.*
    into v_workflow
    from public.klyx_workflows w
   where w.id = p_workflow_id
     and w.account_id = p_account_id
   for update;

  if not found then
    raise exception 'KLYX_WORKFLOW_NOT_FOUND';
  end if;

  if v_workflow.version <> p_expected_version then
    raise exception 'KLYX_WORKFLOW_VERSION_CONFLICT';
  end if;

  if v_workflow.status in ('completed', 'cancelled') then
    raise exception 'KLYX_WORKFLOW_TERMINAL';
  end if;

  if v_workflow.mode = 'request' then
    v_allowed := case v_workflow.current_step
      when 'intention' then p_to_step = 'comprehension'
      when 'comprehension' then p_to_step in ('plan', 'intention')
      when 'plan' then p_to_step in ('search', 'comprehension')
      when 'search' then p_to_step in ('matching', 'plan')
      when 'matching' then p_to_step in ('quote', 'search')
      when 'quote' then p_to_step in ('negotiation_confirmation', 'matching')
      when 'negotiation_confirmation' then p_to_step in ('booking', 'quote', 'matching')
      when 'booking' then p_to_step in ('payment', 'negotiation_confirmation')
      when 'payment' then p_to_step in ('execution', 'incident')
      when 'execution' then p_to_step in ('tracking', 'incident')
      when 'tracking' then p_to_step in ('incident', 'closure')
      when 'incident' then p_to_step in ('refund_replacement', 'tracking')
      when 'refund_replacement' then p_to_step in ('tracking', 'closure')
      else false
    end;
  else
    v_allowed := case v_workflow.current_step
      when 'skill' then p_to_step = 'opportunities'
      when 'opportunities' then p_to_step in ('eligibility', 'skill')
      when 'eligibility' then p_to_step in ('proposal', 'opportunities')
      when 'proposal' then p_to_step in ('acceptance', 'opportunities')
      when 'acceptance' then p_to_step in ('mission', 'proposal')
      when 'mission' then p_to_step = 'completion'
      when 'completion' then p_to_step = 'settlement'
      else false
    end;
  end if;

  if not v_allowed then
    raise exception 'KLYX_WORKFLOW_TRANSITION_INVALID:%->%',
      v_workflow.current_step, p_to_step;
  end if;

  select coalesce(max(s.ordinal), 0) + 1
    into v_next_ordinal
    from public.klyx_workflow_steps s
   where s.workflow_id = v_workflow.id;

  update public.klyx_workflow_steps as workflow_step
     set exited_at = coalesce(workflow_step.exited_at, now())
   where workflow_step.workflow_id = v_workflow.id
     and workflow_step.exited_at is null;

  update public.klyx_workflows as workflow
     set current_step = p_to_step,
         status = case
           when v_workflow.mode = 'request' and p_to_step = 'closure'
             then 'completed'
           else 'active'
         end,
         version = workflow.version + 1,
         completed_at = case
           when v_workflow.mode = 'request' and p_to_step = 'closure'
             then coalesce(workflow.completed_at, now())
           else workflow.completed_at
         end,
         updated_at = now()
   where workflow.id = v_workflow.id
   returning workflow.* into v_workflow;

  insert into public.klyx_workflow_steps (
    workflow_id,
    step,
    ordinal,
    metadata
  )
  values (
    v_workflow.id,
    p_to_step,
    v_next_ordinal,
    coalesce(p_payload, '{}'::jsonb)
  );

  insert into public.klyx_workflow_events (
    workflow_id,
    account_id,
    event_type,
    actor_type,
    step,
    workflow_version,
    payload
  )
  values (
    v_workflow.id,
    v_workflow.account_id,
    left(coalesce(nullif(trim(p_event_type), ''), 'workflow_transition'), 120),
    p_actor_type,
    p_to_step,
    v_workflow.version,
    coalesce(p_payload, '{}'::jsonb)
  );

  return query
  select v_workflow.id, v_workflow.mode, v_workflow.current_step,
         v_workflow.status, v_workflow.version;
end;
$$;

revoke all on function public.klyx_transition_workflow(
  uuid, uuid, bigint, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.klyx_transition_workflow(
  uuid, uuid, bigint, text, text, text, jsonb
) to service_role;

create or replace function public.klyx_complete_settlement_workflow(
  p_workflow_id uuid,
  p_account_id uuid,
  p_expected_version bigint,
  p_event_type text default 'settlement_completed',
  p_actor_type text default 'server',
  p_payload jsonb default '{}'::jsonb
)
returns table (
  workflow_id uuid,
  mode text,
  current_step text,
  status text,
  version bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workflow public.klyx_workflows%rowtype;
  v_booking_id uuid;
  v_booking record;
  v_settlement record;
begin
  if p_actor_type not in ('server', 'system', 'operator') then
    raise exception 'KLYX_WORKFLOW_COMPLETION_ACTOR_INVALID';
  end if;

  select workflow.*
    into v_workflow
    from public.klyx_workflows as workflow
   where workflow.id = p_workflow_id
     and workflow.account_id = p_account_id
   for update;

  if not found then
    raise exception 'KLYX_WORKFLOW_NOT_FOUND';
  end if;

  if v_workflow.version <> p_expected_version then
    raise exception 'KLYX_WORKFLOW_VERSION_CONFLICT';
  end if;

  if v_workflow.mode <> 'earn' or v_workflow.current_step <> 'settlement' then
    raise exception 'KLYX_WORKFLOW_SETTLEMENT_COMPLETION_INVALID';
  end if;

  if v_workflow.status not in ('active', 'waiting') then
    raise exception 'KLYX_WORKFLOW_SETTLEMENT_NOT_COMPLETABLE';
  end if;

  begin
    v_booking_id := coalesce(
      nullif(trim(v_workflow.context ->> 'booking_id'), ''),
      nullif(trim(v_workflow.context ->> 'realized_opportunity_booking_id'), '')
    )::uuid;
  exception when invalid_text_representation then
    raise exception 'KLYX_WORKFLOW_SETTLEMENT_BOOKING_INVALID';
  end;

  if v_booking_id is null then
    raise exception 'KLYX_WORKFLOW_SETTLEMENT_BOOKING_REQUIRED';
  end if;

  select
    booking.status,
    booking.payment_status,
    booking.service_status,
    coalesce(booking.provider_id, booking.babysitter_id) as provider_profile_id
    into v_booking
    from public.bookings as booking
   where booking.id = v_booking_id;

  if not found then
    raise exception 'KLYX_WORKFLOW_SETTLEMENT_BOOKING_NOT_FOUND';
  end if;

  if v_booking.provider_profile_id is distinct from v_workflow.profile_id then
    raise exception 'KLYX_WORKFLOW_SETTLEMENT_PROVIDER_MISMATCH';
  end if;

  if coalesce(v_booking.status, '') <> 'completed'
     or coalesce(v_booking.payment_status, '') <> 'paid'
     or coalesce(v_booking.service_status, '') <> 'completed' then
    raise exception 'KLYX_WORKFLOW_SETTLEMENT_DOMAIN_NOT_COMPLETE';
  end if;

  select
    settlement.state,
    settlement.provider_profile_id,
    settlement.stripe_transfer_id
    into v_settlement
    from public.booking_settlements as settlement
   where settlement.booking_id = v_booking_id;

  if not found
     or v_settlement.provider_profile_id is distinct from v_workflow.profile_id
     or coalesce(v_settlement.state, '') <> 'released'
     or coalesce(trim(v_settlement.stripe_transfer_id), '') = '' then
    raise exception 'KLYX_WORKFLOW_SETTLEMENT_TRUTH_NOT_RELEASED';
  end if;

  if not exists (
    select 1
      from public.financial_ledger_events as ledger
     where ledger.booking_id = v_booking_id
       and ledger.movement_type = 'transfer'
       and ledger.beneficiary_kind = 'provider'
       and ledger.source = 'settlement'
       and ledger.stripe_transfer_id = v_settlement.stripe_transfer_id
  ) then
    raise exception 'KLYX_WORKFLOW_SETTLEMENT_LEDGER_TRANSFER_MISSING';
  end if;

  if exists (
    select 1
      from public.financial_reconciliation_current as reconciliation
     where reconciliation.booking_id = v_booking_id
       and reconciliation.state in ('reconciliation', 'human_review')
  ) then
    raise exception 'KLYX_WORKFLOW_SETTLEMENT_RECONCILIATION_OPEN';
  end if;

  update public.klyx_workflow_steps as workflow_step
     set exited_at = coalesce(workflow_step.exited_at, now())
   where workflow_step.workflow_id = v_workflow.id
     and workflow_step.exited_at is null
     and workflow_step.step = 'settlement';

  update public.klyx_workflows as workflow
     set status = 'completed',
         version = workflow.version + 1,
         completed_at = coalesce(workflow.completed_at, now()),
         updated_at = now()
   where workflow.id = v_workflow.id
   returning workflow.* into v_workflow;

  insert into public.klyx_workflow_events (
    workflow_id,
    account_id,
    event_type,
    actor_type,
    step,
    workflow_version,
    payload
  )
  values (
    v_workflow.id,
    v_workflow.account_id,
    left(coalesce(nullif(trim(p_event_type), ''), 'settlement_completed'), 120),
    p_actor_type,
    'settlement',
    v_workflow.version,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
      'booking_id', v_booking_id,
      'stripe_transfer_id', v_settlement.stripe_transfer_id,
      'settlement_state', v_settlement.state,
      'financial_truth_verified', true
    )
  );

  return query
  select v_workflow.id, v_workflow.mode, v_workflow.current_step,
         v_workflow.status, v_workflow.version;
end;
$$;

revoke all on function public.klyx_complete_settlement_workflow(
  uuid, uuid, bigint, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.klyx_complete_settlement_workflow(
  uuid, uuid, bigint, text, text, jsonb
) to service_role;

comment on function public.klyx_transition_workflow(
  uuid, uuid, bigint, text, text, text, jsonb
) is
  'Canonical persistent KLYX workflow transition authority. Earn mode requires explicit completion before settlement.';

comment on function public.klyx_complete_settlement_workflow(
  uuid, uuid, bigint, text, text, jsonb
) is
  'Completes an earn workflow only after its canonical booking is completed/paid, canonical Settlement is released with a Transfer, central Ledger transfer evidence exists, and no financial reconciliation remains open.';

commit;
