-- Atomic single-charge claim for Platform-Held multi-executor groups.
begin;

alter table public.platform_held_group_settlements
  add column if not exists checkout_attempt_number integer not null default 0
    check (checkout_attempt_number >= 0),
  add column if not exists checkout_claim_token uuid,
  add column if not exists checkout_claimed_at timestamptz,
  add column if not exists checkout_url text;

create or replace function
public.klyx_claim_platform_held_group_checkout(
  p_batch_id uuid,
  p_client_profile_id uuid,
  p_claim_token uuid
)
returns table (
  action text,
  attempt_number integer,
  checkout_session_id text,
  checkout_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.platform_held_group_settlements%rowtype;
begin
  select *
    into v_parent
    from public.platform_held_group_settlements
   where batch_id = p_batch_id
     and client_profile_id = p_client_profile_id
   for update;

  if not found then
    raise exception 'KLYX_GROUP_SETTLEMENT_NOT_FOUND';
  end if;

  if v_parent.state <> 'pending_payment' then
    return query
      select 'paid'::text, v_parent.checkout_attempt_number,
             v_parent.stripe_checkout_session_id, null::text;
    return;
  end if;

  if v_parent.stripe_checkout_session_id is not null then
    return query
      select 'reuse'::text, v_parent.checkout_attempt_number,
             v_parent.stripe_checkout_session_id, v_parent.checkout_url;
    return;
  end if;

  if v_parent.checkout_claim_token is not null
     and v_parent.checkout_claimed_at >
       now() - interval '2 minutes' then
    return query
      select 'busy'::text, v_parent.checkout_attempt_number,
             null::text, null::text;
    return;
  end if;

  update public.platform_held_group_settlements
     set checkout_attempt_number = checkout_attempt_number + 1,
         checkout_claim_token = p_claim_token,
         checkout_claimed_at = now(),
         updated_at = now()
   where batch_id = p_batch_id
   returning * into v_parent;

  return query
    select 'create'::text, v_parent.checkout_attempt_number,
           null::text, null::text;
end;
$$;

create or replace function
public.klyx_attach_platform_held_group_checkout(
  p_batch_id uuid,
  p_claim_token uuid,
  p_checkout_session_id text,
  p_checkout_url text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if coalesce(trim(p_checkout_session_id), '') !~ '^cs_' then
    raise exception 'KLYX_GROUP_SETTLEMENT_CHECKOUT_ID_INVALID';
  end if;

  update public.platform_held_group_settlements
     set stripe_checkout_session_id = p_checkout_session_id,
         checkout_url = p_checkout_url,
         checkout_claim_token = null,
         checkout_claimed_at = null,
         updated_at = now()
   where batch_id = p_batch_id
     and state = 'pending_payment'
     and checkout_claim_token = p_claim_token
     and stripe_checkout_session_id is null;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function
public.klyx_release_platform_held_group_checkout(
  p_batch_id uuid,
  p_checkout_session_id text
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
     set stripe_checkout_session_id = null,
         checkout_url = null,
         checkout_claim_token = null,
         checkout_claimed_at = null,
         updated_at = now()
   where batch_id = p_batch_id
     and state = 'pending_payment'
     and stripe_checkout_session_id = p_checkout_session_id
     and stripe_payment_intent_id is null
     and stripe_charge_id is null;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.klyx_claim_platform_held_group_checkout(
  uuid, uuid, uuid
) from public, anon, authenticated;
revoke all on function public.klyx_attach_platform_held_group_checkout(
  uuid, uuid, text, text
) from public, anon, authenticated;
revoke all on function public.klyx_release_platform_held_group_checkout(
  uuid, text
) from public, anon, authenticated;

grant execute on function public.klyx_claim_platform_held_group_checkout(
  uuid, uuid, uuid
) to service_role;
grant execute on function public.klyx_attach_platform_held_group_checkout(
  uuid, uuid, text, text
) to service_role;
grant execute on function public.klyx_release_platform_held_group_checkout(
  uuid, text
) to service_role;

commit;
