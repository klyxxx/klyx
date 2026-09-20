-- KLYX CENTRAL FINANCIAL LEDGER — GROUP/SPLIT + AGGREGATE HARDENING
--
-- Extends the canonical append-only ledger introduced by
-- 20260920091500_klyx_central_financial_ledger.sql.
--
-- Principles:
-- - one external Stripe object may fund multiple bookings;
-- - every canonical accounting line remains attached to a booking;
-- - group/split amounts are allocated deterministically from frozen booking gross;
-- - no Stripe mutation is performed here;
-- - allocation mismatch opens human_review instead of inventing bookkeeping truth.

begin;

create or replace function public.klyx_group_member_booking_economics(
  p_member_id uuid
)
returns table (
  booking_id uuid,
  client_profile_id uuid,
  provider_profile_id uuid,
  gross_amount_cents bigint,
  platform_fee_cents bigint,
  provider_amount_cents bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.platform_held_group_settlement_members%rowtype;
  v_parent public.platform_held_group_settlements%rowtype;
  v_requested_count integer;
  v_resolved_count integer;
  v_client_count integer;
  v_resolved_gross bigint;
  v_first_booking uuid;
begin
  select *
    into v_member
    from public.platform_held_group_settlement_members
   where id = p_member_id;

  if not found then
    return;
  end if;

  select *
    into v_parent
    from public.platform_held_group_settlements
   where id = v_member.group_settlement_id;

  if not found then
    perform public.klyx_open_financial_reconciliation_case(
      concat('central-ledger:group-member:', p_member_id, ':parent-missing'),
      null,
      'human_review',
      'settlement',
      'group_member_parent_missing',
      jsonb_build_object('group_settlement_id', v_member.group_settlement_id),
      '{}'::jsonb,
      'group_split_ledger_allocation'
    );
    return;
  end if;

  v_requested_count := jsonb_array_length(v_member.booking_ids);

  with requested as (
    select value::uuid as booking_id
      from jsonb_array_elements_text(v_member.booking_ids)
  ),
  resolved as (
    select
      r.booking_id,
      b.parent_id,
      b.currency,
      b.amount_total,
      coalesce(b.provider_id, b.babysitter_id) as provider_profile_id,
      i.id as batch_item_id
    from requested r
    left join public.bookings b
      on b.id = r.booking_id
    left join public.split_booking_batch_items i
      on i.batch_id = v_member.batch_id
     and i.booking_id = r.booking_id
     and i.provider_profile_id = v_member.provider_profile_id
  )
  select
    count(*) filter (
      where booking_id is not null
        and batch_item_id is not null
        and amount_total is not null
        and amount_total > 0
        and upper(coalesce(currency, '')) = upper(v_member.currency)
        and provider_profile_id = v_member.provider_profile_id
    ),
    count(distinct parent_id) filter (where parent_id is not null),
    coalesce(sum(amount_total::bigint) filter (
      where booking_id is not null
        and batch_item_id is not null
        and amount_total is not null
        and amount_total > 0
        and upper(coalesce(currency, '')) = upper(v_member.currency)
        and provider_profile_id = v_member.provider_profile_id
    ), 0),
    min(booking_id)
    into
      v_resolved_count,
      v_client_count,
      v_resolved_gross,
      v_first_booking
    from resolved;

  if v_requested_count <= 0
     or v_resolved_count <> v_requested_count
     or v_client_count <> 1
     or v_resolved_gross <> v_member.gross_amount_cents
     or not exists (
       select 1
         from public.bookings b
        where b.id = v_first_booking
          and b.parent_id = v_parent.client_profile_id
     ) then
    perform public.klyx_open_financial_reconciliation_case(
      concat('central-ledger:group-member:', p_member_id, ':booking-allocation-mismatch'),
      v_first_booking,
      'human_review',
      'settlement',
      'group_member_booking_allocation_mismatch',
      jsonb_build_object(
        'requested_booking_count', v_requested_count,
        'member_gross_amount_cents', v_member.gross_amount_cents,
        'currency', v_member.currency,
        'provider_profile_id', v_member.provider_profile_id,
        'client_profile_id', v_parent.client_profile_id
      ),
      jsonb_build_object(
        'resolved_booking_count', v_resolved_count,
        'resolved_gross_amount_cents', v_resolved_gross,
        'resolved_client_count', v_client_count
      ),
      'group_split_ledger_allocation'
    );
    return;
  end if;

  return query
  with base as (
    select
      b.id as booking_id,
      b.parent_id as client_profile_id,
      v_member.provider_profile_id as provider_profile_id,
      b.amount_total::bigint as gross_amount_cents
    from jsonb_array_elements_text(v_member.booking_ids) j(booking_id_text)
    join public.bookings b
      on b.id = j.booking_id_text::uuid
    join public.split_booking_batch_items i
      on i.batch_id = v_member.batch_id
     and i.booking_id = b.id
     and i.provider_profile_id = v_member.provider_profile_id
    order by b.id
  ),
  running as (
    select
      base.*,
      sum(base.gross_amount_cents) over (
        order by base.booking_id
        rows between unbounded preceding and current row
      ) as cumulative_gross
    from base
  )
  select
    running.booking_id,
    running.client_profile_id,
    running.provider_profile_id,
    running.gross_amount_cents,
    (
      round(
        v_member.platform_fee_cents::numeric
          * running.cumulative_gross::numeric
          / v_member.gross_amount_cents::numeric
      )::bigint
      -
      round(
        v_member.platform_fee_cents::numeric
          * (running.cumulative_gross - running.gross_amount_cents)::numeric
          / v_member.gross_amount_cents::numeric
      )::bigint
    ) as platform_fee_cents,
    running.gross_amount_cents
      -
      (
        round(
          v_member.platform_fee_cents::numeric
            * running.cumulative_gross::numeric
            / v_member.gross_amount_cents::numeric
        )::bigint
        -
        round(
          v_member.platform_fee_cents::numeric
            * (running.cumulative_gross - running.gross_amount_cents)::numeric
            / v_member.gross_amount_cents::numeric
        )::bigint
      ) as provider_amount_cents
  from running;
end;
$$;

create or replace function public.klyx_group_member_amount_allocations(
  p_member_id uuid,
  p_total_amount_cents bigint
)
returns table (
  booking_id uuid,
  amount_cents bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.platform_held_group_settlement_members%rowtype;
begin
  select *
    into v_member
    from public.platform_held_group_settlement_members
   where id = p_member_id;

  if not found then
    return;
  end if;

  if p_total_amount_cents < 0
     or p_total_amount_cents > v_member.gross_amount_cents then
    perform public.klyx_open_financial_reconciliation_case(
      concat(
        'central-ledger:group-member:',
        p_member_id,
        ':amount-allocation-invalid:',
        p_total_amount_cents
      ),
      null,
      'human_review',
      'ledger',
      'group_member_amount_allocation_invalid',
      jsonb_build_object(
        'maximum_amount_cents', v_member.gross_amount_cents
      ),
      jsonb_build_object(
        'requested_amount_cents', p_total_amount_cents
      ),
      'group_split_ledger_allocation'
    );
    return;
  end if;

  return query
  with economics as (
    select *
      from public.klyx_group_member_booking_economics(p_member_id)
  ),
  running as (
    select
      economics.*,
      sum(economics.gross_amount_cents) over (
        order by economics.booking_id
        rows between unbounded preceding and current row
      ) as cumulative_gross,
      sum(economics.gross_amount_cents) over () as total_gross
    from economics
  )
  select
    running.booking_id,
    (
      round(
        p_total_amount_cents::numeric
          * running.cumulative_gross::numeric
          / running.total_gross::numeric
      )::bigint
      -
      round(
        p_total_amount_cents::numeric
          * (running.cumulative_gross - running.gross_amount_cents)::numeric
          / running.total_gross::numeric
      )::bigint
    ) as amount_cents
  from running
  where running.total_gross > 0;
end;
$$;

create or replace function public.klyx_sync_group_member_central_ledger(
  p_member_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.platform_held_group_settlement_members%rowtype;
  v_parent public.platform_held_group_settlements%rowtype;
  v_economics record;
  v_amount record;
  v_reversal record;
  v_refund record;
  v_refund_allocation record;
  v_payment_identity text;
  v_liability_state text;
begin
  select *
    into v_member
    from public.platform_held_group_settlement_members
   where id = p_member_id;

  if not found then
    return false;
  end if;

  select *
    into v_parent
    from public.platform_held_group_settlements
   where id = v_member.group_settlement_id;

  if not found then
    return false;
  end if;

  v_payment_identity := coalesce(
    nullif(trim(v_parent.stripe_payment_intent_id), ''),
    nullif(trim(v_parent.stripe_checkout_session_id), ''),
    v_parent.id::text
  );

  if v_parent.stripe_charge_id is not null then
    for v_economics in
      select *
        from public.klyx_group_member_booking_economics(v_member.id)
    loop
      perform public.klyx_append_financial_ledger_event(
        concat(
          'booking:',
          v_economics.booking_id,
          ':charge:',
          v_payment_identity
        ),
        concat(
          'group-settlement:',
          v_parent.id,
          ':charge:',
          v_parent.stripe_charge_id,
          ':booking:',
          v_economics.booking_id
        ),
        'charge',
        v_economics.gross_amount_cents,
        v_parent.currency,
        v_economics.booking_id,
        'platform',
        'klyx',
        'group_settlement_charge_truth_observed',
        'settlement',
        null,
        v_parent.state,
        coalesce(v_parent.paid_at, v_parent.updated_at, now()),
        null,
        v_parent.stripe_checkout_session_id,
        v_parent.stripe_payment_intent_id,
        v_parent.stripe_charge_id,
        null,
        null,
        null,
        null,
        jsonb_build_object(
          'settlement_model', 'platform_held_group',
          'group_settlement_id', v_parent.id,
          'group_settlement_member_id', v_member.id,
          'batch_id', v_parent.batch_id
        )
      );

      perform public.klyx_append_financial_ledger_event(
        concat(
          'booking:',
          v_economics.booking_id,
          ':commission:',
          v_payment_identity
        ),
        concat(
          'group-settlement:',
          v_parent.id,
          ':commission:booking:',
          v_economics.booking_id
        ),
        'commission',
        v_economics.platform_fee_cents,
        v_parent.currency,
        v_economics.booking_id,
        'platform',
        'klyx',
        'group_settlement_commission_recognized',
        'settlement',
        null,
        'recognized',
        coalesce(v_parent.paid_at, v_parent.updated_at, now()),
        null,
        v_parent.stripe_checkout_session_id,
        v_parent.stripe_payment_intent_id,
        v_parent.stripe_charge_id,
        null,
        null,
        null,
        null,
        jsonb_build_object(
          'settlement_model', 'platform_held_group',
          'group_settlement_id', v_parent.id,
          'group_settlement_member_id', v_member.id,
          'batch_id', v_parent.batch_id
        )
      );

      perform public.klyx_append_financial_ledger_event(
        concat(
          'booking:',
          v_economics.booking_id,
          ':provider-liability:',
          v_payment_identity
        ),
        concat(
          'group-settlement:',
          v_parent.id,
          ':provider-liability:recognized:booking:',
          v_economics.booking_id
        ),
        'provider_liability',
        v_economics.provider_amount_cents,
        v_parent.currency,
        v_economics.booking_id,
        'provider',
        v_member.provider_profile_id::text,
        'group_settlement_provider_liability_recognized',
        'settlement',
        null,
        'recognized',
        coalesce(v_parent.paid_at, v_parent.updated_at, now()),
        v_member.stripe_account_id,
        v_parent.stripe_checkout_session_id,
        v_parent.stripe_payment_intent_id,
        v_parent.stripe_charge_id,
        null,
        null,
        null,
        null,
        jsonb_build_object(
          'settlement_model', 'platform_held_group',
          'group_settlement_id', v_parent.id,
          'group_settlement_member_id', v_member.id,
          'batch_id', v_parent.batch_id
        )
      );
    end loop;
  end if;

  if v_member.stripe_transfer_id is not null then
    for v_amount in
      select *
        from public.klyx_group_member_amount_allocations(
          v_member.id,
          greatest(v_member.released_amount_cents, 0)
        )
    loop
      perform public.klyx_append_financial_ledger_event(
        concat(
          'booking:',
          v_amount.booking_id,
          ':transfer:',
          v_member.stripe_transfer_id
        ),
        concat(
          'group-settlement-member:',
          v_member.id,
          ':transfer:',
          v_member.stripe_transfer_id,
          ':booking:',
          v_amount.booking_id
        ),
        'transfer',
        v_amount.amount_cents,
        v_member.currency,
        v_amount.booking_id,
        'provider',
        v_member.provider_profile_id::text,
        'group_settlement_release',
        'settlement',
        'release_claimed',
        v_member.state,
        coalesce(v_member.released_at, v_member.updated_at, now()),
        v_member.stripe_account_id,
        v_parent.stripe_checkout_session_id,
        v_parent.stripe_payment_intent_id,
        v_parent.stripe_charge_id,
        v_member.stripe_transfer_id,
        null,
        null,
        null,
        jsonb_build_object(
          'settlement_model', 'platform_held_group',
          'group_settlement_id', v_parent.id,
          'group_settlement_member_id', v_member.id,
          'batch_id', v_parent.batch_id,
          'member_released_amount_cents', v_member.released_amount_cents
        )
      );
    end loop;

    for v_economics in
      select *
        from public.klyx_group_member_booking_economics(v_member.id)
    loop
      perform public.klyx_append_financial_ledger_event(
        concat(
          'booking:',
          v_economics.booking_id,
          ':provider-liability:',
          v_payment_identity
        ),
        concat(
          'group-settlement-member:',
          v_member.id,
          ':provider-liability:discharged:',
          v_member.stripe_transfer_id,
          ':booking:',
          v_economics.booking_id
        ),
        'provider_liability',
        v_economics.provider_amount_cents,
        v_member.currency,
        v_economics.booking_id,
        'provider',
        v_member.provider_profile_id::text,
        'group_settlement_release',
        'settlement',
        'recognized',
        'discharged',
        coalesce(v_member.released_at, v_member.updated_at, now()),
        v_member.stripe_account_id,
        v_parent.stripe_checkout_session_id,
        v_parent.stripe_payment_intent_id,
        v_parent.stripe_charge_id,
        v_member.stripe_transfer_id,
        null,
        null,
        null,
        jsonb_build_object(
          'settlement_model', 'platform_held_group',
          'group_settlement_id', v_parent.id,
          'group_settlement_member_id', v_member.id,
          'batch_id', v_parent.batch_id
        )
      );
    end loop;
  end if;

  for v_reversal in
    select
      r.id,
      r.allocation_id,
      r.stripe_transfer_id,
      r.stripe_transfer_reversal_id,
      r.amount_cents,
      r.created_at
    from public.platform_held_group_member_reversals r
    where r.member_id = v_member.id
  loop
    for v_amount in
      select *
        from public.klyx_group_member_amount_allocations(
          v_member.id,
          v_reversal.amount_cents
        )
    loop
      perform public.klyx_append_financial_ledger_event(
        concat(
          'booking:',
          v_amount.booking_id,
          ':reversal:',
          v_reversal.stripe_transfer_reversal_id
        ),
        concat(
          'group-settlement-member:',
          v_member.id,
          ':reversal:',
          v_reversal.stripe_transfer_reversal_id,
          ':booking:',
          v_amount.booking_id
        ),
        'reversal',
        v_amount.amount_cents,
        v_member.currency,
        v_amount.booking_id,
        'platform',
        'klyx',
        'group_settlement_transfer_reversal',
        'settlement',
        'released',
        'reversal_recorded',
        v_reversal.created_at,
        v_member.stripe_account_id,
        v_parent.stripe_checkout_session_id,
        v_parent.stripe_payment_intent_id,
        v_parent.stripe_charge_id,
        v_reversal.stripe_transfer_id,
        v_reversal.stripe_transfer_reversal_id,
        null,
        null,
        jsonb_build_object(
          'settlement_model', 'platform_held_group',
          'group_settlement_id', v_parent.id,
          'group_settlement_member_id', v_member.id,
          'refund_allocation_id', v_reversal.allocation_id,
          'batch_id', v_parent.batch_id
        )
      );
    end loop;
  end loop;

  if v_member.reversed_amount_cents > 0 then
    v_liability_state := case
      when v_member.released_amount_cents > 0
       and v_member.reversed_amount_cents >= v_member.released_amount_cents
        then 'reversed'
      else 'partially_reversed'
    end;

    for v_economics in
      select *
        from public.klyx_group_member_booking_economics(v_member.id)
    loop
      perform public.klyx_append_financial_ledger_event(
        concat(
          'booking:',
          v_economics.booking_id,
          ':provider-liability:',
          v_payment_identity
        ),
        concat(
          'group-settlement-member:',
          v_member.id,
          ':provider-liability:',
          v_liability_state,
          ':',
          v_member.reversed_amount_cents,
          ':booking:',
          v_economics.booking_id
        ),
        'provider_liability',
        v_economics.provider_amount_cents,
        v_member.currency,
        v_economics.booking_id,
        'provider',
        v_member.provider_profile_id::text,
        'group_settlement_transfer_reversal',
        'settlement',
        'discharged',
        v_liability_state,
        v_member.updated_at,
        v_member.stripe_account_id,
        v_parent.stripe_checkout_session_id,
        v_parent.stripe_payment_intent_id,
        v_parent.stripe_charge_id,
        v_member.stripe_transfer_id,
        null,
        null,
        null,
        jsonb_build_object(
          'settlement_model', 'platform_held_group',
          'group_settlement_id', v_parent.id,
          'group_settlement_member_id', v_member.id,
          'member_reversed_amount_cents', v_member.reversed_amount_cents,
          'batch_id', v_parent.batch_id
        )
      );
    end loop;
  end if;

  for v_refund_allocation in
    select
      a.id as allocation_id,
      a.gross_refund_cents,
      r.id as refund_id,
      r.stripe_refund_id,
      r.state as refund_state,
      r.completed_at,
      r.updated_at
    from public.platform_held_group_refund_allocations a
    join public.platform_held_group_refunds r
      on r.id = a.refund_id
    where a.member_id = v_member.id
      and r.state = 'succeeded'
      and r.stripe_refund_id is not null
  loop
    for v_amount in
      select *
        from public.klyx_group_member_amount_allocations(
          v_member.id,
          v_refund_allocation.gross_refund_cents
        )
    loop
      perform public.klyx_append_financial_ledger_event(
        concat(
          'booking:',
          v_amount.booking_id,
          ':refund:',
          v_refund_allocation.stripe_refund_id
        ),
        concat(
          'group-refund:',
          v_refund_allocation.refund_id,
          ':allocation:',
          v_refund_allocation.allocation_id,
          ':booking:',
          v_amount.booking_id
        ),
        'refund',
        v_amount.amount_cents,
        v_member.currency,
        v_amount.booking_id,
        'client',
        v_parent.client_profile_id::text,
        'group_settlement_refund_succeeded',
        'refund',
        'refunding',
        'succeeded',
        coalesce(
          v_refund_allocation.completed_at,
          v_refund_allocation.updated_at,
          now()
        ),
        v_member.stripe_account_id,
        v_parent.stripe_checkout_session_id,
        v_parent.stripe_payment_intent_id,
        v_parent.stripe_charge_id,
        v_member.stripe_transfer_id,
        null,
        v_refund_allocation.stripe_refund_id,
        null,
        jsonb_build_object(
          'settlement_model', 'platform_held_group',
          'group_settlement_id', v_parent.id,
          'group_settlement_member_id', v_member.id,
          'refund_allocation_id', v_refund_allocation.allocation_id,
          'batch_id', v_parent.batch_id
        )
      );
    end loop;
  end loop;

  return true;
end;
$$;

create or replace function public.klyx_sync_group_central_ledger(
  p_group_settlement_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member record;
begin
  for v_member in
    select id
      from public.platform_held_group_settlement_members
     where group_settlement_id = p_group_settlement_id
  loop
    perform public.klyx_sync_group_member_central_ledger(v_member.id);
  end loop;

  return true;
end;
$$;

create or replace function public.klyx_sync_group_parent_central_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.klyx_sync_group_central_ledger(new.id);
  return new;
end;
$$;

create or replace function public.klyx_sync_group_member_central_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.klyx_sync_group_member_central_ledger(new.id);
  return new;
end;
$$;

create or replace function public.klyx_sync_group_refund_central_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.klyx_sync_group_central_ledger(new.group_settlement_id);
  return new;
end;
$$;

create or replace function public.klyx_sync_group_reversal_central_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.klyx_sync_group_member_central_ledger(new.member_id);
  return new;
end;
$$;

drop trigger if exists platform_held_group_parent_central_ledger_mirror
  on public.platform_held_group_settlements;
create trigger platform_held_group_parent_central_ledger_mirror
after insert or update on public.platform_held_group_settlements
for each row
execute function public.klyx_sync_group_parent_central_ledger_trigger();

drop trigger if exists platform_held_group_member_central_ledger_mirror
  on public.platform_held_group_settlement_members;
create trigger platform_held_group_member_central_ledger_mirror
after insert or update on public.platform_held_group_settlement_members
for each row
execute function public.klyx_sync_group_member_central_ledger_trigger();

drop trigger if exists platform_held_group_refund_central_ledger_mirror
  on public.platform_held_group_refunds;
create trigger platform_held_group_refund_central_ledger_mirror
after insert or update on public.platform_held_group_refunds
for each row
execute function public.klyx_sync_group_refund_central_ledger_trigger();

drop trigger if exists platform_held_group_reversal_central_ledger_mirror
  on public.platform_held_group_member_reversals;
create trigger platform_held_group_reversal_central_ledger_mirror
after insert on public.platform_held_group_member_reversals
for each row
execute function public.klyx_sync_group_reversal_central_ledger_trigger();

do $$
declare
  v_parent record;
begin
  for v_parent in
    select id
      from public.platform_held_group_settlements
  loop
    perform public.klyx_sync_group_central_ledger(v_parent.id);
  end loop;
end;
$$;

revoke all on function public.klyx_group_member_booking_economics(uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_group_member_amount_allocations(uuid, bigint)
  from public, anon, authenticated;
revoke all on function public.klyx_sync_group_member_central_ledger(uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_sync_group_central_ledger(uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_sync_group_parent_central_ledger_trigger()
  from public, anon, authenticated;
revoke all on function public.klyx_sync_group_member_central_ledger_trigger()
  from public, anon, authenticated;
revoke all on function public.klyx_sync_group_refund_central_ledger_trigger()
  from public, anon, authenticated;
revoke all on function public.klyx_sync_group_reversal_central_ledger_trigger()
  from public, anon, authenticated;

grant execute on function public.klyx_sync_group_member_central_ledger(uuid)
  to service_role;
grant execute on function public.klyx_sync_group_central_ledger(uuid)
  to service_role;

comment on function public.klyx_group_member_booking_economics(uuid) is
  'Deterministic booking-level allocation of frozen group/split economics. Allocation mismatch opens human_review instead of inventing ledger truth.';

comment on function public.klyx_sync_group_member_central_ledger(uuid) is
  'Idempotently mirrors platform-held group/split charge, commission, provider liability, transfer, reversal and refund truth into the canonical append-only KLYX ledger.';

commit;
