-- KLYX PLATFORM-HELD SETTLEMENT — CLAIM SQL QUALIFICATION
--
-- PostgreSQL exposes RETURNS TABLE column names as PL/pgSQL variables. The
-- settlement claim RPC therefore must qualify table columns whose names overlap
-- those output variables. This append-only correction preserves all existing
-- fail-closed release semantics while removing the stripe_account_id ambiguity.

begin;

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

revoke all on function public.klyx_claim_booking_settlement_release(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.klyx_claim_booking_settlement_release(uuid, uuid)
  to service_role;

comment on function public.klyx_claim_booking_settlement_release(uuid, uuid) is
  'Server-only fail-closed release claim. Qualified source columns prevent RETURNS TABLE output variables from shadowing canonical Stripe identity fields.';

commit;
