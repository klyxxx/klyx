-- KLYX Platform-Held multi-executor release-after-refund hardening — TEST only
--
-- A member can be partially refunded before its service is released.
-- Therefore the amount eligible for a future Transfer is NOT necessarily the
-- original frozen provider_amount_cents. Freeze the exact claim/release amount
-- and serialize aggregate net entitlement under the parent row lock.

begin;

alter table public.platform_held_group_settlement_members
  add column if not exists release_claim_amount_cents bigint not null default 0,
  add column if not exists released_amount_cents bigint not null default 0;

-- Existing TEST rows created before this hardening used the full provider
-- amount for a persisted Transfer. Preserve that historical truth.
update public.platform_held_group_settlement_members
   set released_amount_cents = provider_amount_cents
 where stripe_transfer_id is not null
   and released_amount_cents = 0;

-- An old unresolved claim with a prior provider refund is ambiguous: the
-- pre-hardening code could have attempted the original amount. Fail closed.
update public.platform_held_group_settlement_members
   set state = 'review_required',
       release_claim_token = null,
       release_claimed_at = null,
       release_claim_amount_cents = 0,
       last_error_code = 'pre_hardening_refund_release_claim_ambiguous',
       last_error_message =
         'Release claim predates net-entitlement hardening and requires Stripe truth review.',
       updated_at = now()
 where state = 'release_claimed'
   and refunded_provider_amount_cents > 0;

update public.platform_held_group_settlement_members
   set release_claim_amount_cents = provider_amount_cents
 where state = 'release_claimed'
   and refunded_provider_amount_cents = 0
   and release_claim_amount_cents = 0;

alter table public.platform_held_group_settlement_members
  drop constraint if exists klyx_platform_held_group_member_release_amounts;

alter table public.platform_held_group_settlement_members
  add constraint klyx_platform_held_group_member_release_amounts
  check (
    release_claim_amount_cents >= 0
    and released_amount_cents >= 0
    and release_claim_amount_cents
      <= provider_amount_cents - refunded_provider_amount_cents
    and released_amount_cents <= provider_amount_cents
    and reversed_amount_cents <= released_amount_cents
  );

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

create or replace function public.klyx_finalize_platform_held_group_member_release(
  p_member_id uuid,
  p_claim_token uuid,
  p_stripe_transfer_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.platform_held_group_settlement_members%rowtype;
  v_parent public.platform_held_group_settlements%rowtype;
  v_remaining integer;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_GROUP_HELD_TRANSFER_ID_INVALID';
  end if;

  select m.*
    into v_member
    from public.platform_held_group_settlement_members m
   where m.id = p_member_id;

  if not found then return false; end if;

  select p.*
    into v_parent
    from public.platform_held_group_settlements p
   where p.id = v_member.group_settlement_id
   for update;

  update public.platform_held_group_settlement_members
     set state = 'released',
         stripe_transfer_id = coalesce(stripe_transfer_id, p_stripe_transfer_id),
         released_amount_cents = release_claim_amount_cents,
         released_at = coalesce(released_at, now()),
         release_claim_token = null,
         release_claimed_at = null,
         release_claim_amount_cents = 0,
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where id = p_member_id
     and state = 'release_claimed'
     and release_claim_token = p_claim_token
     and release_claim_amount_cents > 0
     and (stripe_transfer_id is null or stripe_transfer_id = p_stripe_transfer_id)
   returning * into v_member;

  if not found then return false; end if;

  select count(*)
    into v_remaining
    from public.platform_held_group_settlement_members m
   where m.group_settlement_id = v_member.group_settlement_id
     and m.provider_amount_cents - m.refunded_provider_amount_cents > 0
     and m.stripe_transfer_id is null;

  update public.platform_held_group_settlements
     set state = case
           when refunded_amount_cents = gross_amount_cents then 'refunded'
           when refunded_amount_cents > 0 then 'partially_refunded'
           when v_remaining = 0 then 'released'
           else 'release_partial'
         end,
         updated_at = now()
   where id = v_member.group_settlement_id
     and state in ('held', 'release_partial', 'released', 'partially_refunded');

  return true;
end;
$$;

create or replace function public.klyx_reconcile_platform_held_group_member_release(
  p_member_id uuid,
  p_stripe_transfer_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.platform_held_group_settlement_members%rowtype;
  v_parent public.platform_held_group_settlements%rowtype;
  v_expected_release bigint;
  v_remaining integer;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_GROUP_HELD_TRANSFER_ID_INVALID';
  end if;

  select m.*
    into v_member
    from public.platform_held_group_settlement_members m
   where m.id = p_member_id;

  if not found then return false; end if;

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

  if v_member.stripe_transfer_id is not null then
    return v_member.stripe_transfer_id = p_stripe_transfer_id;
  end if;

  if v_member.state in (
    'refund_pending',
    'partially_reversed',
    'reversed',
    'review_required'
  ) then
    return false;
  end if;

  v_expected_release := case
    when v_member.release_claim_amount_cents > 0
      then v_member.release_claim_amount_cents
    else v_member.provider_amount_cents - v_member.refunded_provider_amount_cents
  end;

  if v_expected_release <= 0 then
    return false;
  end if;

  update public.platform_held_group_settlement_members
     set state = 'released',
         stripe_transfer_id = p_stripe_transfer_id,
         released_amount_cents = v_expected_release,
         released_at = coalesce(released_at, now()),
         release_claim_token = null,
         release_claimed_at = null,
         release_claim_amount_cents = 0,
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where id = p_member_id;

  select count(*)
    into v_remaining
    from public.platform_held_group_settlement_members m
   where m.group_settlement_id = v_member.group_settlement_id
     and m.provider_amount_cents - m.refunded_provider_amount_cents > 0
     and m.stripe_transfer_id is null;

  update public.platform_held_group_settlements
     set state = case
           when refunded_amount_cents = gross_amount_cents then 'refunded'
           when refunded_amount_cents > 0 then 'partially_refunded'
           when v_remaining = 0 then 'released'
           else 'release_partial'
         end,
         updated_at = now()
   where id = v_member.group_settlement_id
     and state in ('held', 'release_partial', 'released', 'partially_refunded');

  return true;
end;
$$;

create or replace function public.klyx_reopen_platform_held_group_member_release_after_no_transfer(
  p_member_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.platform_held_group_settlement_members
     set state = 'release_failed',
         release_claim_token = null,
         release_claimed_at = null,
         release_claim_amount_cents = 0,
         last_error_code = 'group_member_recovery_no_transfer',
         last_error_message =
           'Expired release claim reopened only after Stripe truth showed no member Transfer.',
         updated_at = now()
   where id = p_member_id
     and state = 'release_claimed'
     and release_claimed_at is not null
     and release_claimed_at <= now() - interval '10 minutes'
     and stripe_transfer_id is null;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_fail_platform_held_group_member_release(
  p_member_id uuid,
  p_claim_token uuid,
  p_error_code text,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.platform_held_group_settlement_members
     set state = 'release_failed',
         release_claim_token = null,
         release_claimed_at = null,
         release_claim_amount_cents = 0,
         last_error_code = left(coalesce(p_error_code, 'group_member_release_failed'), 120),
         last_error_message = left(coalesce(p_error_message, 'Group member release failed.'), 1000),
         updated_at = now()
   where id = p_member_id
     and state = 'release_claimed'
     and release_claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_mark_platform_held_group_review(
  p_group_settlement_id uuid,
  p_error_code text,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.platform_held_group_settlements
     set state = 'review_required',
         checkout_claim_token = null,
         checkout_claimed_at = null,
         updated_at = now()
   where id = p_group_settlement_id
     and state <> 'refunded';

  get diagnostics v_updated = row_count;

  if v_updated = 1 then
    update public.platform_held_group_settlement_members
       set state = case
             when state = 'reversed' then state
             else 'review_required'
           end,
           release_claim_token = null,
           release_claimed_at = null,
           release_claim_amount_cents = 0,
           last_error_code = left(coalesce(p_error_code, 'group_review_required'), 120),
           last_error_message = left(coalesce(p_error_message, 'Group settlement requires review.'), 1000),
           updated_at = now()
     where group_settlement_id = p_group_settlement_id;
  end if;

  return v_updated = 1;
end;
$$;

create or replace function public.klyx_mark_platform_held_group_member_review(
  p_member_id uuid,
  p_error_code text,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.platform_held_group_settlement_members
     set state = 'review_required',
         release_claim_token = null,
         release_claimed_at = null,
         release_claim_amount_cents = 0,
         last_error_code = left(coalesce(p_error_code, 'group_member_review_required'), 120),
         last_error_message = left(coalesce(p_error_message, 'Group member requires review.'), 1000),
         updated_at = now()
   where id = p_member_id
     and state <> 'reversed';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

comment on column public.platform_held_group_settlement_members.release_claim_amount_cents is
  'Exact provider cents reserved by the serialized release claim after prior successful refunds.';
comment on column public.platform_held_group_settlement_members.released_amount_cents is
  'Exact historical Stripe Transfer amount for this executor; may be below frozen provider_amount_cents after pre-release refunds.';
comment on function public.klyx_claim_platform_held_group_member_release(uuid, uuid) is
  'Serializes member release against parent, current post-refund provider entitlement, sibling claims, persisted net transfers and Trust/Risk gates.';

commit;
