-- ============================================================
-- KLYX MISSION 11 — ECONOMIC ELIGIBILITY -> SETTLEMENT GATE
--
-- Authority order for NEW money movement:
--   canonical account / activity context
--   -> economic eligibility decision
--   -> transaction-risk decision
--   -> atomic release claim
--   -> remote Stripe truth
--   -> Stripe Transfer
--
-- Stripe facts are evidence only. payouts_enabled=true is never sufficient.
-- ============================================================

begin;

create table if not exists public.economic_settlement_eligibility_decisions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null
    references public.accounts(id)
    on delete cascade,
  economic_identity_id uuid not null,
  source_trust_decision_id uuid
    references public.trust_eligibility_decisions(id)
    on delete set null,
  stripe_account_id text,
  subject_type text not null,
  subject_id text not null,
  activity_key text not null,
  jurisdiction_code text not null,
  decision text not null,
  reason_codes jsonb not null default '[]'::jsonb,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  decision_source text not null default 'deterministic_rule',
  evaluated_at timestamptz not null default now(),
  expires_at timestamptz not null,

  constraint economic_settlement_decision_identity_account_fkey
    foreign key (economic_identity_id, account_id)
    references public.economic_identities(id, account_id)
    on delete cascade,
  constraint economic_settlement_decision_stripe_account_fkey
    foreign key (account_id, stripe_account_id)
    references public.account_stripe_connect_identities(account_id, stripe_account_id)
    on delete restrict,
  constraint economic_settlement_decision_subject_type_check
    check (
      char_length(subject_type) between 2 and 80
      and subject_type ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint economic_settlement_decision_subject_id_check
    check (char_length(trim(subject_id)) between 1 and 256),
  constraint economic_settlement_decision_activity_key_check
    check (
      char_length(activity_key) between 1 and 120
      and activity_key ~ '^[a-z0-9][a-z0-9_.:-]*$'
    ),
  constraint economic_settlement_decision_jurisdiction_check
    check (char_length(trim(jurisdiction_code)) between 2 and 32),
  constraint economic_settlement_decision_value_check
    check (decision in ('allowed', 'human_review', 'blocked')),
  constraint economic_settlement_decision_source_check
    check (decision_source = 'deterministic_rule'),
  constraint economic_settlement_decision_reason_codes_array_check
    check (jsonb_typeof(reason_codes) = 'array'),
  constraint economic_settlement_decision_evidence_object_check
    check (jsonb_typeof(evidence_snapshot) = 'object'),
  constraint economic_settlement_decision_expiry_check
    check (
      expires_at > evaluated_at
      and expires_at <= evaluated_at + interval '5 minutes'
    ),
  constraint economic_settlement_allowed_sources_check
    check (
      decision <> 'allowed'
      or (
        source_trust_decision_id is not null
        and stripe_account_id is not null
      )
    )
);

comment on table public.economic_settlement_eligibility_decisions is
  'Append-only deterministic Mission 11 snapshots. A fresh allowed row is necessary but still not sufficient: transaction risk, atomic claim and remote Stripe truth remain separate gates.';
comment on column public.economic_settlement_eligibility_decisions.stripe_account_id is
  'Canonical Stripe destination observed during eligibility evaluation. Stripe never becomes the KLYX authorization authority.';
comment on column public.economic_settlement_eligibility_decisions.evidence_snapshot is
  'Normalized ids/statuses only. Never persist raw identity documents, tax identifiers, provider KYC payloads or private conversation content here.';

create index if not exists economic_settlement_decision_claim_lookup_idx
  on public.economic_settlement_eligibility_decisions (
    account_id,
    subject_type,
    subject_id,
    decision,
    evaluated_at desc
  );

create index if not exists economic_settlement_decision_review_idx
  on public.economic_settlement_eligibility_decisions (
    decision,
    evaluated_at desc
  )
  where decision <> 'allowed';

alter table public.economic_settlement_eligibility_decisions
  enable row level security;

revoke all privileges on table public.economic_settlement_eligibility_decisions
  from public, anon, authenticated;
grant select, insert on table public.economic_settlement_eligibility_decisions
  to service_role;

drop policy if exists klyx_economic_settlement_decisions_server_only
  on public.economic_settlement_eligibility_decisions;
create policy klyx_economic_settlement_decisions_server_only
  on public.economic_settlement_eligibility_decisions
  for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function public.klyx_reject_economic_settlement_decision_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'KLYX_ECONOMIC_SETTLEMENT_DECISIONS_APPEND_ONLY';
end;
$$;

alter function public.klyx_reject_economic_settlement_decision_mutation()
  owner to postgres;
revoke all on function public.klyx_reject_economic_settlement_decision_mutation()
  from public, anon, authenticated;
grant execute on function public.klyx_reject_economic_settlement_decision_mutation()
  to service_role;

drop trigger if exists klyx_economic_settlement_decisions_append_only
  on public.economic_settlement_eligibility_decisions;
create trigger klyx_economic_settlement_decisions_append_only
before update or delete on public.economic_settlement_eligibility_decisions
for each row
execute function public.klyx_reject_economic_settlement_decision_mutation();

create or replace function public.klyx_reconcile_booking_settlement_release(
  p_booking_id uuid,
  p_stripe_transfer_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
  v_existing text;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_SETTLEMENT_TRANSFER_ID_INVALID';
  end if;

  select stripe_transfer_id
    into v_existing
    from public.booking_settlements
   where booking_id = p_booking_id
   for update;

  if not found then
    return false;
  end if;

  if v_existing is not null then
    return v_existing = p_stripe_transfer_id;
  end if;

  update public.booking_settlements
     set state = 'released',
         stripe_transfer_id = p_stripe_transfer_id,
         released_at = now(),
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where booking_id = p_booking_id
     and state = 'release_claimed';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.klyx_reconcile_booking_settlement_release(uuid, text)
  from public, anon, authenticated;
grant execute on function public.klyx_reconcile_booking_settlement_release(uuid, text)
  to service_role;

comment on function public.klyx_reconcile_booking_settlement_release(uuid, text) is
  'Local reconciliation only after server-side verification of an already-existing Stripe Transfer. It never creates money movement and therefore must remain usable when a later eligibility gate blocks new movement.';

create or replace function public.klyx_claim_booking_settlement_release(
  p_booking_id uuid,
  p_claim_token uuid
)
returns table (
  action text,
  attempt_number integer,
  provider_profile_id uuid,
  stripe_account_id text,
  provider_amount_cents integer,
  currency text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  transfer_group text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.booking_settlements%rowtype;
  v_booking record;
  v_profile_account_id uuid;
  v_profile_owner_user_id uuid;
  v_account_id uuid;
  v_account_stripe_id text;
  v_account_connect_state text;
  v_economic_allowed boolean := false;
  v_risk_allowed boolean := false;
begin
  if p_claim_token is null then
    raise exception 'KLYX_SETTLEMENT_CLAIM_TOKEN_REQUIRED';
  end if;

  select s.*
    into v_settlement
    from public.booking_settlements as s
   where s.booking_id = p_booking_id
   for update;

  if not found then
    return query
      select 'not_ready'::text, 0, null::uuid, null::text, null::integer,
             null::text, null::text, null::text, null::text;
    return;
  end if;

  if v_settlement.state = 'released' then
    return query
      select 'released'::text,
             v_settlement.release_attempt_number,
             v_settlement.provider_profile_id,
             v_settlement.stripe_account_id,
             v_settlement.provider_amount_cents,
             v_settlement.currency,
             v_settlement.stripe_payment_intent_id,
             v_settlement.stripe_charge_id,
             v_settlement.transfer_group;
    return;
  end if;

  if v_settlement.state in ('refund_pending', 'refunded', 'review_required') then
    return query
      select 'not_ready'::text,
             v_settlement.release_attempt_number,
             v_settlement.provider_profile_id,
             v_settlement.stripe_account_id,
             v_settlement.provider_amount_cents,
             v_settlement.currency,
             v_settlement.stripe_payment_intent_id,
             v_settlement.stripe_charge_id,
             v_settlement.transfer_group;
    return;
  end if;

  if v_settlement.state = 'release_claimed'
     and v_settlement.release_claimed_at is not null
     and v_settlement.release_claimed_at > now() - interval '10 minutes' then
    return query
      select 'busy'::text,
             v_settlement.release_attempt_number,
             v_settlement.provider_profile_id,
             v_settlement.stripe_account_id,
             v_settlement.provider_amount_cents,
             v_settlement.currency,
             v_settlement.stripe_payment_intent_id,
             v_settlement.stripe_charge_id,
             v_settlement.transfer_group;
    return;
  end if;

  select b.status, b.payment_status, b.refund_status, b.payment_mode, b.booking_group_id
    into v_booking
    from public.bookings as b
   where b.id = p_booking_id;

  if not found
     or coalesce(v_booking.status, '') <> 'completed'
     or coalesce(v_booking.payment_status, '') <> 'paid'
     or coalesce(v_booking.payment_mode, '') <> 'platform_held'
     or v_booking.booking_group_id is not null
     or coalesce(v_booking.refund_status, '') in ('processing', 'succeeded')
     or v_settlement.state not in ('held', 'release_failed', 'release_claimed')
     or coalesce(trim(v_settlement.stripe_payment_intent_id), '') = ''
     or coalesce(trim(v_settlement.stripe_charge_id), '') = '' then
    return query
      select 'not_ready'::text,
             v_settlement.release_attempt_number,
             v_settlement.provider_profile_id,
             v_settlement.stripe_account_id,
             v_settlement.provider_amount_cents,
             v_settlement.currency,
             v_settlement.stripe_payment_intent_id,
             v_settlement.stripe_charge_id,
             v_settlement.transfer_group;
    return;
  end if;

  select p.account_id, p.owner_user_id
    into v_profile_account_id, v_profile_owner_user_id
    from public.profiles as p
   where p.id = v_settlement.provider_profile_id;

  if not found then
    return query
      select 'not_ready'::text,
             v_settlement.release_attempt_number,
             v_settlement.provider_profile_id,
             v_settlement.stripe_account_id,
             v_settlement.provider_amount_cents,
             v_settlement.currency,
             v_settlement.stripe_payment_intent_id,
             v_settlement.stripe_charge_id,
             v_settlement.transfer_group;
    return;
  end if;

  v_account_id := v_profile_account_id;

  if v_account_id is null then
    select a.id
      into v_account_id
      from public.accounts as a
     where a.auth_user_id = v_profile_owner_user_id
     limit 1;
  end if;

  if v_account_id is null then
    return query
      select 'not_ready'::text,
             v_settlement.release_attempt_number,
             v_settlement.provider_profile_id,
             v_settlement.stripe_account_id,
             v_settlement.provider_amount_cents,
             v_settlement.currency,
             v_settlement.stripe_payment_intent_id,
             v_settlement.stripe_charge_id,
             v_settlement.transfer_group;
    return;
  end if;

  select identity.stripe_account_id, identity.identity_state
    into v_account_stripe_id, v_account_connect_state
    from public.account_stripe_connect_identities as identity
   where identity.account_id = v_account_id;

  if not found
     or coalesce(v_account_connect_state, '') <> 'linked'
     or v_account_stripe_id is distinct from v_settlement.stripe_account_id then
    return query
      select 'not_ready'::text,
             v_settlement.release_attempt_number,
             v_settlement.provider_profile_id,
             v_settlement.stripe_account_id,
             v_settlement.provider_amount_cents,
             v_settlement.currency,
             v_settlement.stripe_payment_intent_id,
             v_settlement.stripe_charge_id,
             v_settlement.transfer_group;
    return;
  end if;

  select exists (
    select 1
      from public.economic_settlement_eligibility_decisions as d
     where d.account_id = v_account_id
       and d.subject_type = 'booking'
       and d.subject_id = p_booking_id::text
       and d.stripe_account_id = v_settlement.stripe_account_id
       and d.decision = 'allowed'
       and d.evaluated_at >= now() - interval '5 minutes'
       and d.expires_at > now()
  ) into v_economic_allowed;

  if not v_economic_allowed then
    return query
      select 'not_ready'::text,
             v_settlement.release_attempt_number,
             v_settlement.provider_profile_id,
             v_settlement.stripe_account_id,
             v_settlement.provider_amount_cents,
             v_settlement.currency,
             v_settlement.stripe_payment_intent_id,
             v_settlement.stripe_charge_id,
             v_settlement.transfer_group;
    return;
  end if;

  select exists (
    select 1
      from public.transaction_risk_decisions as d
     where d.account_id = v_account_id
       and d.action = 'settlement_release'
       and d.participant = 'settlement_recipient'
       and d.subject_type = 'booking'
       and d.subject_id = p_booking_id::text
       and d.decision = 'allow'
       and d.risk_assessed_at >= now() - interval '5 minutes'
  ) into v_risk_allowed;

  if not v_risk_allowed then
    return query
      select 'not_ready'::text,
             v_settlement.release_attempt_number,
             v_settlement.provider_profile_id,
             v_settlement.stripe_account_id,
             v_settlement.provider_amount_cents,
             v_settlement.currency,
             v_settlement.stripe_payment_intent_id,
             v_settlement.stripe_charge_id,
             v_settlement.transfer_group;
    return;
  end if;

  update public.booking_settlements as s
     set state = 'release_claimed',
         release_attempt_number = s.release_attempt_number + 1,
         release_claim_token = p_claim_token,
         release_claimed_at = now(),
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where s.booking_id = p_booking_id
   returning s.* into v_settlement;

  return query
    select 'create'::text,
           v_settlement.release_attempt_number,
           v_settlement.provider_profile_id,
           v_settlement.stripe_account_id,
           v_settlement.provider_amount_cents,
           v_settlement.currency,
           v_settlement.stripe_payment_intent_id,
           v_settlement.stripe_charge_id,
           v_settlement.transfer_group;
end;
$$;

create or replace function public.klyx_claim_platform_held_group_member_release(
  p_member_id uuid,
  p_claim_token uuid
)
returns table (
  action text,
  attempt_number integer,
  batch_id uuid,
  provider_profile_id uuid,
  provider_account_id uuid,
  stripe_account_id text,
  provider_amount_cents bigint,
  currency text,
  stripe_charge_id text,
  transfer_group text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.platform_held_group_settlement_members%rowtype;
  v_parent public.platform_held_group_settlements%rowtype;
  v_total_member_provider bigint;
  v_current_provider_budget bigint;
  v_committed_provider bigint;
  v_release_amount bigint;
  v_incomplete integer;
  v_economic_missing integer;
begin
  select m.*
    into v_member
    from public.platform_held_group_settlement_members m
   where m.id = p_member_id;

  if not found then
    raise exception 'KLYX_GROUP_HELD_MEMBER_NOT_FOUND';
  end if;

  -- Parent is the serialization barrier for every member claim and refund plan.
  select p.*
    into v_parent
    from public.platform_held_group_settlements p
   where p.id = v_member.group_settlement_id
   for update;

  select m.*
    into v_member
    from public.platform_held_group_settlement_members m
   where m.id = p_member_id
   for update;

  if v_member.state = 'released' and v_member.stripe_transfer_id is not null then
    return query select
      'released'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.released_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if v_parent.state in ('refund_pending', 'refunded', 'review_required')
     or coalesce(trim(v_parent.stripe_charge_id), '') !~ '^ch_[A-Za-z0-9_]+$'
     or v_member.state in (
       'refund_pending',
       'partially_reversed',
       'reversed',
       'review_required'
     ) then
    return query select
      'not_ready'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, 0::bigint,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if v_member.state = 'release_claimed' then
    return query select
      'busy'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.release_claim_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  select count(*)
    into v_incomplete
    from jsonb_array_elements_text(v_member.booking_ids) booking_id
    left join public.bookings b on b.id = booking_id::uuid
   where b.id is null
      or coalesce(b.payment_status, '') <> 'paid'
      or (
        coalesce(b.status, '') <> 'completed'
        and coalesce(b.service_status, '') <> 'completed'
      );

  if v_incomplete > 0 then
    return query select
      'not_ready'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, 0::bigint,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if not exists (
    select 1
      from public.account_stripe_connect_identities i
     where i.account_id = v_member.provider_account_id
       and i.identity_state = 'linked'
       and i.stripe_account_id = v_member.stripe_account_id
  ) then
    return query select
      'review_required'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, 0::bigint,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  select count(*)
    into v_economic_missing
    from jsonb_array_elements_text(v_member.booking_ids) as booking_id
   where not exists (
    select 1
      from public.economic_settlement_eligibility_decisions as d
     where d.account_id = v_member.provider_account_id
       and d.subject_type = 'booking'
       and d.subject_id = booking_id
       and d.stripe_account_id = v_member.stripe_account_id
       and d.decision = 'allowed'
       and d.evaluated_at >= now() - interval '5 minutes'
       and d.expires_at > now()
  );

  if v_economic_missing > 0 then
    return query select
      'review_required'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, 0::bigint,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if not exists (
    select 1
      from public.transaction_risk_decisions d
     where d.account_id = v_member.provider_account_id
       and d.action = 'settlement_release'
       and d.participant = 'settlement_recipient'
       and d.subject_type = 'split_batch'
       and d.subject_id = v_member.batch_id::text
       and d.decision = 'allow'
       and d.risk_assessed_at >= now() - interval '5 minutes'
  ) then
    return query select
      'not_ready'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, 0::bigint,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  select coalesce(sum(m.provider_amount_cents), 0)
    into v_total_member_provider
    from public.platform_held_group_settlement_members m
   where m.group_settlement_id = v_parent.id;

  if v_total_member_provider <> v_parent.provider_amount_cents then
    raise exception 'KLYX_GROUP_HELD_MEMBER_PROVIDER_TOTAL_MISMATCH';
  end if;

  v_release_amount :=
    v_member.provider_amount_cents - v_member.refunded_provider_amount_cents;

  if v_release_amount <= 0 then
    return query select
      'not_ready'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, 0::bigint,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  select coalesce(
    sum(m.provider_amount_cents - m.refunded_provider_amount_cents),
    0
  )
    into v_current_provider_budget
    from public.platform_held_group_settlement_members m
   where m.group_settlement_id = v_parent.id;

  select coalesce(sum(
    case
      when m.stripe_transfer_id is not null
        then greatest(m.released_amount_cents - m.reversed_amount_cents, 0)
      when m.state = 'release_claimed'
        then m.release_claim_amount_cents
      else 0
    end
  ), 0)
    into v_committed_provider
    from public.platform_held_group_settlement_members m
   where m.group_settlement_id = v_parent.id
     and m.id <> v_member.id;

  if v_current_provider_budget < 0
     or v_current_provider_budget > v_parent.provider_amount_cents
     or v_committed_provider + v_release_amount > v_current_provider_budget
     or v_committed_provider + v_release_amount > v_parent.provider_amount_cents then
    raise exception 'KLYX_GROUP_HELD_AGGREGATE_OVERTRANSFER_GUARD';
  end if;

  update public.platform_held_group_settlement_members
     set state = 'release_claimed',
         release_attempt_number = release_attempt_number + 1,
         release_claim_token = p_claim_token,
         release_claimed_at = now(),
         release_claim_amount_cents = v_release_amount,
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where id = v_member.id
   returning * into v_member;

  return query select
    'create'::text, v_member.release_attempt_number, v_member.batch_id,
    v_member.provider_profile_id, v_member.provider_account_id,
    v_member.stripe_account_id, v_member.release_claim_amount_cents,
    v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
end;
$$;


revoke all on function public.klyx_claim_booking_settlement_release(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.klyx_claim_booking_settlement_release(uuid, uuid)
  to service_role;

comment on function public.klyx_claim_booking_settlement_release(uuid, uuid) is
  'Server-only fail-closed claim. Requires a fresh Mission 11 economic allow and then a fresh independent transaction-risk allow before reserving a Stripe Transfer attempt.';

revoke all on function public.klyx_claim_platform_held_group_member_release(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.klyx_claim_platform_held_group_member_release(uuid, uuid)
  to service_role;

comment on function public.klyx_claim_platform_held_group_member_release(uuid, uuid) is
  'Serialized group member claim. Every member booking requires a fresh Mission 11 economic allow, followed by the existing independent transaction-risk allow and aggregate money guards.';

commit;
