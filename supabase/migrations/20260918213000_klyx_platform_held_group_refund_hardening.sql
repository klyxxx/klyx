-- KLYX Platform-Held multi-executor group refund hardening — TEST only
--
-- Additive hardening after the dormant multi-executor settlement foundation.
-- 1) Partial-refund KLYX/provider economics are deterministic and enforced in SQL.
-- 2) A Stripe refund may finalize from both ready and refunding because the
--    application moves the plan to refunding immediately before the Stripe write.

begin;

create or replace function public.klyx_guard_platform_held_group_refund_allocation_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.platform_held_group_settlement_members%rowtype;
  v_prior_gross bigint;
  v_prior_fee bigint;
  v_prior_provider bigint;
  v_cumulative_gross bigint;
  v_target_fee bigint;
  v_target_provider bigint;
begin
  select *
    into v_member
    from public.platform_held_group_settlement_members
   where id = new.member_id
   for update;

  if not found then
    raise exception 'KLYX_GROUP_HELD_REFUND_MEMBER_INVALID';
  end if;

  select
    coalesce(sum(a.gross_refund_cents), 0),
    coalesce(sum(a.platform_fee_refund_cents), 0),
    coalesce(sum(a.provider_refund_cents), 0)
    into v_prior_gross, v_prior_fee, v_prior_provider
    from public.platform_held_group_refund_allocations a
    join public.platform_held_group_refunds r on r.id = a.refund_id
   where a.member_id = new.member_id
     and a.refund_id <> new.refund_id
     and r.state <> 'failed';

  if v_prior_fee + v_prior_provider <> v_prior_gross then
    raise exception 'KLYX_GROUP_HELD_REFUND_PRIOR_ACCOUNTING_MISMATCH';
  end if;

  v_cumulative_gross := v_prior_gross + new.gross_refund_cents;

  if v_cumulative_gross > v_member.gross_amount_cents then
    raise exception 'KLYX_GROUP_HELD_REFUND_MEMBER_EXCEEDS_GROSS';
  end if;

  v_target_fee := round(
    v_member.platform_fee_cents::numeric
      * v_cumulative_gross::numeric
      / v_member.gross_amount_cents::numeric
  )::bigint;
  v_target_provider := v_cumulative_gross - v_target_fee;

  if new.platform_fee_refund_cents <> v_target_fee - v_prior_fee
     or new.provider_refund_cents <> v_target_provider - v_prior_provider
     or new.platform_fee_refund_cents < 0
     or new.provider_refund_cents < 0
     or new.platform_fee_refund_cents + new.provider_refund_cents
       <> new.gross_refund_cents then
    raise exception 'KLYX_GROUP_HELD_REFUND_ALLOCATION_POLICY_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists platform_held_group_refund_allocation_policy_guard
  on public.platform_held_group_refund_allocations;

create trigger platform_held_group_refund_allocation_policy_guard
before insert or update of
  gross_refund_cents,
  platform_fee_refund_cents,
  provider_refund_cents
on public.platform_held_group_refund_allocations
for each row
execute function public.klyx_guard_platform_held_group_refund_allocation_policy();

create or replace function public.klyx_finalize_platform_held_group_refund(
  p_refund_id uuid,
  p_stripe_refund_id text,
  p_amount_cents bigint,
  p_currency text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund public.platform_held_group_refunds%rowtype;
  v_parent public.platform_held_group_settlements%rowtype;
  v_allocation record;
  v_total_refunded bigint;
begin
  if coalesce(trim(p_stripe_refund_id), '') !~ '^re_[A-Za-z0-9]+$'
     or p_amount_cents <= 0 then
    raise exception 'KLYX_GROUP_HELD_REFUND_TRUTH_INVALID';
  end if;

  select *
    into v_refund
    from public.platform_held_group_refunds
   where id = p_refund_id
   for update;

  if not found then return false; end if;

  if v_refund.state = 'succeeded' then
    return v_refund.stripe_refund_id = p_stripe_refund_id
       and v_refund.amount_cents = p_amount_cents
       and v_refund.currency = upper(p_currency);
  end if;

  if v_refund.state not in ('ready', 'refunding')
     or v_refund.amount_cents <> p_amount_cents
     or v_refund.currency <> upper(p_currency)
     or (v_refund.stripe_refund_id is not null
         and v_refund.stripe_refund_id <> p_stripe_refund_id)
     or exists (
       select 1
         from public.platform_held_group_refund_allocations a
        where a.refund_id = v_refund.id
          and a.state not in ('ready', 'reversed')
     ) then
    return false;
  end if;

  select *
    into v_parent
    from public.platform_held_group_settlements
   where id = v_refund.group_settlement_id
   for update;

  if not found then
    raise exception 'KLYX_GROUP_HELD_PARENT_NOT_FOUND';
  end if;

  for v_allocation in
    select *
      from public.platform_held_group_refund_allocations
     where refund_id = v_refund.id
     for update
  loop
    update public.platform_held_group_settlement_members
       set refunded_gross_amount_cents =
             refunded_gross_amount_cents + v_allocation.gross_refund_cents,
           refunded_platform_fee_cents =
             refunded_platform_fee_cents + v_allocation.platform_fee_refund_cents,
           refunded_provider_amount_cents =
             refunded_provider_amount_cents + v_allocation.provider_refund_cents,
           updated_at = now()
     where id = v_allocation.member_id;

    update public.platform_held_group_refund_allocations
       set state = 'refunded',
           updated_at = now()
     where id = v_allocation.id;
  end loop;

  update public.platform_held_group_refunds
     set state = 'succeeded',
         stripe_refund_id = p_stripe_refund_id,
         completed_at = coalesce(completed_at, now()),
         updated_at = now()
   where id = v_refund.id;

  select coalesce(sum(amount_cents), 0)
    into v_total_refunded
    from public.platform_held_group_refunds
   where group_settlement_id = v_parent.id
     and state = 'succeeded';

  if v_total_refunded > v_parent.gross_amount_cents then
    raise exception 'KLYX_GROUP_HELD_REFUND_TOTAL_EXCEEDS_GROSS';
  end if;

  update public.platform_held_group_settlements
     set refunded_amount_cents = v_total_refunded,
         state = case
           when v_total_refunded = gross_amount_cents then 'refunded'
           when exists (
             select 1
               from public.platform_held_group_settlement_members m
              where m.group_settlement_id =
                    public.platform_held_group_settlements.id
                and m.stripe_transfer_id is not null
           ) then 'release_partial'
           else 'partially_refunded'
         end,
         refunded_at = case
           when v_total_refunded = gross_amount_cents
             then coalesce(refunded_at, now())
           else refunded_at
         end,
         updated_at = now()
   where id = v_parent.id;

  return true;
end;
$$;

revoke all on function public.klyx_guard_platform_held_group_refund_allocation_policy()
  from public, anon, authenticated;
grant execute on function public.klyx_guard_platform_held_group_refund_allocation_policy()
  to service_role;

revoke all on function public.klyx_finalize_platform_held_group_refund(
  uuid, text, bigint, text
) from public, anon, authenticated;
grant execute on function public.klyx_finalize_platform_held_group_refund(
  uuid, text, bigint, text
) to service_role;

comment on function public.klyx_guard_platform_held_group_refund_allocation_policy() is
  'Enforces cumulative nearest-cent proportional refund allocation from frozen member economics. Clients cannot choose who bears refund pennies.';

commit;
