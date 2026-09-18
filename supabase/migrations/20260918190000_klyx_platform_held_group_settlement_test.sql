-- KLYX PLATFORM-HELD GROUP SETTLEMENT — STRIPE TEST ONLY
--
-- Extends the certified single-booking held settlement invariant to one
-- booking_group / one provider / one provider Transfer. No live activation.

begin;

create table if not exists public.booking_group_settlements (
  booking_group_id uuid primary key references public.booking_groups(id) on delete restrict,
  provider_profile_id uuid not null references public.profiles(id) on delete restrict,
  stripe_account_id text not null check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  payment_mode text not null default 'platform_held' check (payment_mode = 'platform_held'),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  gross_amount_cents integer not null check (gross_amount_cents > 0),
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  provider_amount_cents integer not null check (provider_amount_cents >= 0),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  stripe_transfer_id text unique,
  stripe_transfer_reversal_id text unique,
  transfer_group text not null unique,
  state text not null default 'pending_payment'
    check (state in (
      'pending_payment','held','review_required','release_claimed','released',
      'release_failed','refund_pending','refunded'
    )),
  release_reason_codes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(release_reason_codes) = 'array'),
  release_attempt_number integer not null default 0 check (release_attempt_number >= 0),
  release_claim_token uuid,
  release_claimed_at timestamptz,
  released_at timestamptz,
  transfer_reversed_at timestamptz,
  refunded_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (platform_fee_cents + provider_amount_cents = gross_amount_cents),
  check (state <> 'released' or (stripe_transfer_id is not null and released_at is not null)),
  check (state <> 'refunded' or stripe_transfer_id is null or stripe_transfer_reversal_id is not null)
);

create unique index if not exists booking_group_settlements_checkout_session_uidx
  on public.booking_group_settlements(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists booking_group_settlements_state_idx
  on public.booking_group_settlements(state, updated_at);

alter table public.booking_group_settlements enable row level security;
revoke all privileges on table public.booking_group_settlements from public, anon, authenticated;
grant select, insert, update, delete on table public.booking_group_settlements to service_role;

create or replace function public.klyx_persist_platform_held_group_checkout(
  p_group_id uuid,
  p_client_profile_id uuid,
  p_attempt_token uuid,
  p_checkout_session_id text,
  p_provider_profile_id uuid,
  p_stripe_account_id text,
  p_currency text,
  p_gross_amount_cents integer,
  p_platform_fee_cents integer,
  p_provider_amount_cents integer,
  p_transfer_group text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.booking_groups%rowtype;
  v_settlement public.booking_group_settlements%rowtype;
begin
  if p_attempt_token is null then raise exception 'KLYX_GROUP_HELD_ATTEMPT_TOKEN_REQUIRED'; end if;
  if coalesce(trim(p_checkout_session_id),'') !~ '^cs_[A-Za-z0-9_]+$' then raise exception 'KLYX_GROUP_HELD_CHECKOUT_INVALID'; end if;
  if coalesce(trim(p_stripe_account_id),'') !~ '^acct_[A-Za-z0-9]+$' then raise exception 'KLYX_GROUP_HELD_STRIPE_ACCOUNT_INVALID'; end if;
  if coalesce(trim(p_currency),'') !~ '^[A-Z]{3}$' then raise exception 'KLYX_GROUP_HELD_CURRENCY_INVALID'; end if;
  if p_gross_amount_cents <= 0
     or p_platform_fee_cents < 0
     or p_provider_amount_cents < 0
     or p_platform_fee_cents + p_provider_amount_cents <> p_gross_amount_cents then
    raise exception 'KLYX_GROUP_HELD_ECONOMICS_INVALID';
  end if;
  if coalesce(trim(p_transfer_group),'') = '' then raise exception 'KLYX_GROUP_HELD_TRANSFER_GROUP_REQUIRED'; end if;

  select * into v_group
    from public.booking_groups
   where id = p_group_id
   for update;

  if not found then raise exception 'KLYX_GROUP_HELD_NOT_FOUND'; end if;
  if v_group.client_profile_id <> p_client_profile_id then raise exception 'KLYX_GROUP_HELD_OWNER_MISMATCH'; end if;
  if v_group.provider_profile_id <> p_provider_profile_id then raise exception 'KLYX_GROUP_HELD_PROVIDER_MISMATCH'; end if;
  if coalesce(v_group.status,'') <> 'accepted'
     or coalesce(v_group.payment_status,'') <> 'processing'
     or v_group.payment_attempt_token is distinct from p_attempt_token then
    raise exception 'KLYX_GROUP_HELD_PAYMENT_CLAIM_LOST';
  end if;
  if exists (
    select 1 from public.bookings b
     where b.booking_group_id = p_group_id
       and coalesce(b.provider_id,b.babysitter_id) is distinct from p_provider_profile_id
  ) then
    raise exception 'KLYX_GROUP_HELD_CHILD_PROVIDER_MISMATCH';
  end if;

  select * into v_settlement
    from public.booking_group_settlements
   where booking_group_id = p_group_id
   for update;

  if found then
    if v_settlement.state <> 'pending_payment' then raise exception 'KLYX_GROUP_HELD_SETTLEMENT_ALREADY_ACTIVE'; end if;
    if v_settlement.provider_profile_id <> p_provider_profile_id
       or v_settlement.stripe_account_id <> p_stripe_account_id
       or v_settlement.currency <> p_currency
       or v_settlement.gross_amount_cents <> p_gross_amount_cents
       or v_settlement.platform_fee_cents <> p_platform_fee_cents
       or v_settlement.provider_amount_cents <> p_provider_amount_cents
       or v_settlement.transfer_group <> p_transfer_group then
      raise exception 'KLYX_GROUP_HELD_IMMUTABLE_TRUTH_MISMATCH';
    end if;

    update public.booking_group_settlements
       set stripe_checkout_session_id = p_checkout_session_id, updated_at = now()
     where booking_group_id = p_group_id;
  else
    insert into public.booking_group_settlements (
      booking_group_id, provider_profile_id, stripe_account_id, payment_mode,
      currency, gross_amount_cents, platform_fee_cents, provider_amount_cents,
      stripe_checkout_session_id, transfer_group, state
    ) values (
      p_group_id, p_provider_profile_id, p_stripe_account_id, 'platform_held',
      p_currency, p_gross_amount_cents, p_platform_fee_cents, p_provider_amount_cents,
      p_checkout_session_id, p_transfer_group, 'pending_payment'
    );
  end if;

  update public.booking_groups
     set payment_mode = 'platform_held',
         stripe_checkout_session_id = p_checkout_session_id,
         application_fee_amount = p_platform_fee_cents,
         platform_fee_amount = p_platform_fee_cents,
         provider_amount = p_provider_amount_cents,
         payment_attempt_token = null,
         payment_checkout_started_at = null,
         updated_at = now()
   where id = p_group_id;

  return true;
end;
$$;

create or replace function public.klyx_release_expired_booking_group_checkout(
  p_group_id uuid,
  p_checkout_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_updated integer;
begin
  update public.booking_groups
     set payment_status = 'failed',
         stripe_checkout_session_id = null,
         payment_attempt_token = null,
         payment_checkout_started_at = null,
         updated_at = now()
   where id = p_group_id
     and stripe_checkout_session_id = p_checkout_session_id
     and payment_status <> 'paid';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_guard_platform_held_group_economics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_settlement public.booking_group_settlements%rowtype;
begin
  if coalesce(new.payment_mode,'') <> 'platform_held' or coalesce(new.payment_status,'') <> 'paid' then
    return new;
  end if;

  select * into v_settlement
    from public.booking_group_settlements
   where booking_group_id = new.id;

  if not found then raise exception 'KLYX_GROUP_HELD_SETTLEMENT_MISSING'; end if;
  if coalesce(trim(new.stripe_payment_intent_id),'') !~ '^pi_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_GROUP_HELD_PAYMENT_INTENT_REQUIRED';
  end if;

  new.total_amount_cents := v_settlement.gross_amount_cents;
  new.currency := v_settlement.currency;
  new.application_fee_amount := v_settlement.platform_fee_cents;
  new.platform_fee_amount := v_settlement.platform_fee_cents;
  new.provider_amount := v_settlement.provider_amount_cents;
  return new;
end;
$$;

drop trigger if exists booking_groups_platform_held_economics_guard on public.booking_groups;
create trigger booking_groups_platform_held_economics_guard
before update on public.booking_groups
for each row execute function public.klyx_guard_platform_held_group_economics();

create or replace function public.klyx_mark_platform_held_group_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_updated integer;
begin
  if coalesce(new.payment_mode,'') <> 'platform_held'
     or coalesce(new.payment_status,'') <> 'paid'
     or coalesce(old.payment_status,'') = 'paid' then
    return new;
  end if;

  update public.booking_group_settlements
     set state = case when state = 'pending_payment' then 'held' else state end,
         stripe_checkout_session_id = coalesce(stripe_checkout_session_id,new.stripe_checkout_session_id),
         stripe_payment_intent_id = coalesce(stripe_payment_intent_id,new.stripe_payment_intent_id),
         updated_at = now()
   where booking_group_id = new.id
     and state in ('pending_payment','held');

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then raise exception 'KLYX_GROUP_HELD_PAID_SETTLEMENT_NOT_WRITABLE'; end if;
  return new;
end;
$$;

drop trigger if exists booking_groups_platform_held_paid_reconcile on public.booking_groups;
create trigger booking_groups_platform_held_paid_reconcile
after update of payment_status on public.booking_groups
for each row execute function public.klyx_mark_platform_held_group_paid();

create or replace function public.klyx_attach_booking_group_settlement_stripe_truth(
  p_group_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_charge_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_updated integer;
begin
  if coalesce(trim(p_payment_intent_id),'') !~ '^pi_[A-Za-z0-9_]+$' then raise exception 'KLYX_GROUP_SETTLEMENT_PAYMENT_INTENT_INVALID'; end if;
  if coalesce(trim(p_charge_id),'') !~ '^ch_[A-Za-z0-9_]+$' then raise exception 'KLYX_GROUP_SETTLEMENT_CHARGE_INVALID'; end if;

  update public.booking_group_settlements
     set stripe_checkout_session_id = coalesce(stripe_checkout_session_id,p_checkout_session_id),
         stripe_payment_intent_id = coalesce(stripe_payment_intent_id,p_payment_intent_id),
         stripe_charge_id = coalesce(stripe_charge_id,p_charge_id),
         updated_at = now()
   where booking_group_id = p_group_id
     and stripe_checkout_session_id = p_checkout_session_id
     and (stripe_payment_intent_id is null or stripe_payment_intent_id = p_payment_intent_id)
     and (stripe_charge_id is null or stripe_charge_id = p_charge_id);

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_mark_booking_group_settlement_review_required(
  p_group_id uuid,
  p_reason_codes text[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_updated integer;
begin
  update public.booking_group_settlements
     set state = 'review_required',
         release_reason_codes = to_jsonb(coalesce(p_reason_codes,array[]::text[])),
         release_claim_token = null,
         release_claimed_at = null,
         updated_at = now()
   where booking_group_id = p_group_id
     and state not in ('released','refund_pending','refunded');

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_claim_booking_group_settlement_release(
  p_group_id uuid,
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
  v_settlement public.booking_group_settlements%rowtype;
  v_group public.booking_groups%rowtype;
  v_profile_account_id uuid;
  v_profile_owner_user_id uuid;
  v_account_id uuid;
  v_account_stripe_id text;
  v_identity_state text;
  v_risk_allowed boolean := false;
begin
  if p_claim_token is null then raise exception 'KLYX_GROUP_SETTLEMENT_CLAIM_TOKEN_REQUIRED'; end if;

  select s.* into v_settlement
    from public.booking_group_settlements s
   where s.booking_group_id = p_group_id
   for update;

  if not found then
    return query select 'not_ready'::text,0,null::uuid,null::text,null::integer,null::text,null::text,null::text,null::text;
    return;
  end if;

  if v_settlement.state = 'released' then
    return query select 'released'::text,v_settlement.release_attempt_number,v_settlement.provider_profile_id,
      v_settlement.stripe_account_id,v_settlement.provider_amount_cents,v_settlement.currency,
      v_settlement.stripe_payment_intent_id,v_settlement.stripe_charge_id,v_settlement.transfer_group;
    return;
  end if;

  if v_settlement.state in ('refund_pending','refunded','review_required') then
    return query select 'not_ready'::text,v_settlement.release_attempt_number,v_settlement.provider_profile_id,
      v_settlement.stripe_account_id,v_settlement.provider_amount_cents,v_settlement.currency,
      v_settlement.stripe_payment_intent_id,v_settlement.stripe_charge_id,v_settlement.transfer_group;
    return;
  end if;

  if v_settlement.state = 'release_claimed'
     and v_settlement.release_claimed_at > now() - interval '10 minutes' then
    return query select 'busy'::text,v_settlement.release_attempt_number,v_settlement.provider_profile_id,
      v_settlement.stripe_account_id,v_settlement.provider_amount_cents,v_settlement.currency,
      v_settlement.stripe_payment_intent_id,v_settlement.stripe_charge_id,v_settlement.transfer_group;
    return;
  end if;

  select * into v_group from public.booking_groups g where g.id = p_group_id;
  if not found
     or coalesce(v_group.status,'') <> 'completed'
     or coalesce(v_group.payment_status,'') <> 'paid'
     or coalesce(v_group.payment_mode,'') <> 'platform_held'
     or coalesce(v_group.refund_status,'') in ('processing','refunded','review_required')
     or v_settlement.state not in ('held','release_failed','release_claimed')
     or coalesce(trim(v_settlement.stripe_payment_intent_id),'') = ''
     or coalesce(trim(v_settlement.stripe_charge_id),'') = ''
     or exists (
       select 1 from public.bookings b
        where b.booking_group_id = p_group_id
          and (coalesce(b.status,'') <> 'completed' or coalesce(b.payment_status,'') <> 'paid')
     ) then
    return query select 'not_ready'::text,v_settlement.release_attempt_number,v_settlement.provider_profile_id,
      v_settlement.stripe_account_id,v_settlement.provider_amount_cents,v_settlement.currency,
      v_settlement.stripe_payment_intent_id,v_settlement.stripe_charge_id,v_settlement.transfer_group;
    return;
  end if;

  select p.account_id,p.owner_user_id
    into v_profile_account_id,v_profile_owner_user_id
    from public.profiles p
   where p.id = v_settlement.provider_profile_id;

  if not found then
    return query select 'not_ready'::text,v_settlement.release_attempt_number,v_settlement.provider_profile_id,
      v_settlement.stripe_account_id,v_settlement.provider_amount_cents,v_settlement.currency,
      v_settlement.stripe_payment_intent_id,v_settlement.stripe_charge_id,v_settlement.transfer_group;
    return;
  end if;

  v_account_id := v_profile_account_id;
  if v_account_id is null then
    select a.id into v_account_id from public.accounts a
     where a.auth_user_id = v_profile_owner_user_id limit 1;
  end if;

  select i.stripe_account_id,i.identity_state
    into v_account_stripe_id,v_identity_state
    from public.account_stripe_connect_identities i
   where i.account_id = v_account_id;

  if v_account_id is null
     or not found
     or coalesce(v_identity_state,'') <> 'linked'
     or v_account_stripe_id is distinct from v_settlement.stripe_account_id then
    return query select 'not_ready'::text,v_settlement.release_attempt_number,v_settlement.provider_profile_id,
      v_settlement.stripe_account_id,v_settlement.provider_amount_cents,v_settlement.currency,
      v_settlement.stripe_payment_intent_id,v_settlement.stripe_charge_id,v_settlement.transfer_group;
    return;
  end if;

  select exists (
    select 1 from public.transaction_risk_decisions d
     where d.account_id = v_account_id
       and d.action = 'settlement_release'
       and d.participant = 'settlement_recipient'
       and d.subject_type = 'booking_group'
       and d.subject_id = p_group_id::text
       and d.decision = 'allow'
       and d.risk_assessed_at >= now() - interval '5 minutes'
  ) into v_risk_allowed;

  if not v_risk_allowed then
    return query select 'not_ready'::text,v_settlement.release_attempt_number,v_settlement.provider_profile_id,
      v_settlement.stripe_account_id,v_settlement.provider_amount_cents,v_settlement.currency,
      v_settlement.stripe_payment_intent_id,v_settlement.stripe_charge_id,v_settlement.transfer_group;
    return;
  end if;

  update public.booking_group_settlements s
     set state = 'release_claimed',
         release_attempt_number = s.release_attempt_number + 1,
         release_claim_token = p_claim_token,
         release_claimed_at = now(),
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where s.booking_group_id = p_group_id
   returning s.* into v_settlement;

  return query select 'create'::text,v_settlement.release_attempt_number,v_settlement.provider_profile_id,
    v_settlement.stripe_account_id,v_settlement.provider_amount_cents,v_settlement.currency,
    v_settlement.stripe_payment_intent_id,v_settlement.stripe_charge_id,v_settlement.transfer_group;
end;
$$;

create or replace function public.klyx_finalize_booking_group_settlement_release(
  p_group_id uuid,
  p_claim_token uuid,
  p_stripe_transfer_id text
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_updated integer;
begin
  if coalesce(trim(p_stripe_transfer_id),'') !~ '^tr_[A-Za-z0-9]+$' then raise exception 'KLYX_GROUP_SETTLEMENT_TRANSFER_INVALID'; end if;
  update public.booking_group_settlements
     set state='released', stripe_transfer_id=p_stripe_transfer_id, released_at=now(),
         release_claim_token=null, release_claimed_at=null, last_error_code=null,last_error_message=null,updated_at=now()
   where booking_group_id=p_group_id and state='release_claimed' and release_claim_token=p_claim_token;
  get diagnostics v_updated=row_count;
  return v_updated=1;
end;
$$;

create or replace function public.klyx_fail_booking_group_settlement_release(
  p_group_id uuid,
  p_claim_token uuid,
  p_error_code text,
  p_error_message text
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_updated integer;
begin
  update public.booking_group_settlements
     set state='release_failed', release_claim_token=null, release_claimed_at=null,
         last_error_code=left(coalesce(p_error_code,'group_settlement_release_failed'),120),
         last_error_message=left(coalesce(p_error_message,'Group settlement release failed.'),1000),
         updated_at=now()
   where booking_group_id=p_group_id and state='release_claimed' and release_claim_token=p_claim_token;
  get diagnostics v_updated=row_count;
  return v_updated=1;
end;
$$;

create or replace function public.klyx_prepare_booking_group_settlement_refund(
  p_group_id uuid
)
returns table (
  action text,
  stripe_transfer_id text,
  provider_amount_cents integer,
  stripe_transfer_reversal_id text
)
language plpgsql security definer set search_path = public
as $$
declare v_settlement public.booking_group_settlements%rowtype;
begin
  select s.* into v_settlement
    from public.booking_group_settlements s
   where s.booking_group_id=p_group_id
   for update;

  if not found then
    return query select 'not_applicable'::text,null::text,null::integer,null::text;
    return;
  end if;

  if v_settlement.state='refunded' then
    return query select 'refunded'::text,v_settlement.stripe_transfer_id,v_settlement.provider_amount_cents,v_settlement.stripe_transfer_reversal_id;
    return;
  end if;

  if v_settlement.state='release_claimed' then
    return query select 'busy'::text,v_settlement.stripe_transfer_id,v_settlement.provider_amount_cents,v_settlement.stripe_transfer_reversal_id;
    return;
  end if;

  update public.booking_group_settlements
     set state='refund_pending',updated_at=now()
   where booking_group_id=p_group_id
     and state in ('pending_payment','held','review_required','release_failed','released','refund_pending')
   returning * into v_settlement;

  if not found then
    return query select 'not_ready'::text,null::text,null::integer,null::text;
    return;
  end if;

  if v_settlement.stripe_transfer_id is not null and v_settlement.stripe_transfer_reversal_id is null then
    return query select 'reverse_transfer'::text,v_settlement.stripe_transfer_id,v_settlement.provider_amount_cents,null::text;
  else
    return query select 'refund_ready'::text,v_settlement.stripe_transfer_id,v_settlement.provider_amount_cents,v_settlement.stripe_transfer_reversal_id;
  end if;
end;
$$;

create or replace function public.klyx_finalize_booking_group_settlement_reversal(
  p_group_id uuid,
  p_stripe_transfer_id text,
  p_stripe_transfer_reversal_id text
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_updated integer;
begin
  if coalesce(trim(p_stripe_transfer_reversal_id),'') !~ '^trr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_GROUP_SETTLEMENT_REVERSAL_INVALID';
  end if;

  update public.booking_group_settlements
     set stripe_transfer_reversal_id=coalesce(stripe_transfer_reversal_id,p_stripe_transfer_reversal_id),
         transfer_reversed_at=coalesce(transfer_reversed_at,now()),
         state='refund_pending',updated_at=now()
   where booking_group_id=p_group_id
     and stripe_transfer_id=p_stripe_transfer_id
     and (stripe_transfer_reversal_id is null or stripe_transfer_reversal_id=p_stripe_transfer_reversal_id);

  get diagnostics v_updated=row_count;
  return v_updated=1;
end;
$$;

create or replace function public.klyx_finalize_platform_held_group_settlement_on_refund()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_settlement public.booking_group_settlements%rowtype;
begin
  if coalesce(new.payment_mode,'') <> 'platform_held' then return new; end if;
  if coalesce(new.payment_status,'') <> 'refunded' and coalesce(new.refund_status,'') <> 'refunded' then return new; end if;

  select * into v_settlement
    from public.booking_group_settlements
   where booking_group_id=new.id
   for update;

  if not found then raise exception 'KLYX_GROUP_SETTLEMENT_REFUND_SETTLEMENT_MISSING'; end if;
  if v_settlement.state='release_claimed' then raise exception 'KLYX_GROUP_SETTLEMENT_REFUND_RELEASE_CLAIM_ACTIVE'; end if;
  if v_settlement.stripe_transfer_id is not null and v_settlement.stripe_transfer_reversal_id is null then
    raise exception 'KLYX_GROUP_SETTLEMENT_REFUND_REVERSAL_REQUIRED';
  end if;

  update public.booking_group_settlements
     set state='refunded',refunded_at=coalesce(refunded_at,now()),
         release_claim_token=null,release_claimed_at=null,last_error_code=null,last_error_message=null,updated_at=now()
   where booking_group_id=new.id;
  return new;
end;
$$;

drop trigger if exists booking_groups_platform_held_terminal_refund_guard on public.booking_groups;
create trigger booking_groups_platform_held_terminal_refund_guard
before update of payment_status, refund_status on public.booking_groups
for each row execute function public.klyx_finalize_platform_held_group_settlement_on_refund();

revoke all on function public.klyx_persist_platform_held_group_checkout(uuid,uuid,uuid,text,uuid,text,text,integer,integer,integer,text) from public,anon,authenticated;
revoke all on function public.klyx_release_expired_booking_group_checkout(uuid,text) from public,anon,authenticated;
revoke all on function public.klyx_attach_booking_group_settlement_stripe_truth(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.klyx_mark_booking_group_settlement_review_required(uuid,text[]) from public,anon,authenticated;
revoke all on function public.klyx_claim_booking_group_settlement_release(uuid,uuid) from public,anon,authenticated;
revoke all on function public.klyx_finalize_booking_group_settlement_release(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.klyx_fail_booking_group_settlement_release(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.klyx_prepare_booking_group_settlement_refund(uuid) from public,anon,authenticated;
revoke all on function public.klyx_finalize_booking_group_settlement_reversal(uuid,text,text) from public,anon,authenticated;
revoke all on function public.klyx_finalize_platform_held_group_settlement_on_refund() from public,anon,authenticated;

grant execute on function public.klyx_persist_platform_held_group_checkout(uuid,uuid,uuid,text,uuid,text,text,integer,integer,integer,text) to service_role;
grant execute on function public.klyx_release_expired_booking_group_checkout(uuid,text) to service_role;
grant execute on function public.klyx_attach_booking_group_settlement_stripe_truth(uuid,text,text,text) to service_role;
grant execute on function public.klyx_mark_booking_group_settlement_review_required(uuid,text[]) to service_role;
grant execute on function public.klyx_claim_booking_group_settlement_release(uuid,uuid) to service_role;
grant execute on function public.klyx_finalize_booking_group_settlement_release(uuid,uuid,text) to service_role;
grant execute on function public.klyx_fail_booking_group_settlement_release(uuid,uuid,text,text) to service_role;
grant execute on function public.klyx_prepare_booking_group_settlement_refund(uuid) to service_role;
grant execute on function public.klyx_finalize_booking_group_settlement_reversal(uuid,text,text) to service_role;
grant execute on function public.klyx_finalize_platform_held_group_settlement_on_refund() to service_role;

commit;
