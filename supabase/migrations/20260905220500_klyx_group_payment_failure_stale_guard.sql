-- KLYX group-payment stale failure hardening
--
-- Service-role webhook handlers intentionally bypass RLS. Keep the database as
-- the final financial boundary: a late PaymentIntent failure must never poison
-- a newer group checkout attempt or a terminal payment state.

create or replace function public.klyx_guard_group_payment_failure_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- This guard is only about writes that record a payment failure. Successful
  -- reconciliation clears payment_failed_at and must remain able to recover a
  -- previously failed attempt.
  if new.payment_failed_at is null then
    return new;
  end if;

  if new.payment_failed_at is not distinct from old.payment_failed_at
     and new.payment_failure_code is not distinct from old.payment_failure_code
     and new.payment_failure_message is not distinct from old.payment_failure_message then
    return new;
  end if;

  -- A failure belongs only to the Checkout attempt that is currently attached.
  -- creating_checkout, failed, paid and refunded are all non-writable for a
  -- newly arriving failure event.
  if old.payment_status is distinct from 'checkout_created' then
    return old;
  end if;

  -- Once a PaymentIntent is attached, an older/different intent is never
  -- allowed to replace it through a failure webhook.
  if old.stripe_payment_intent_id is not null
     and new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists klyx_guard_group_payment_failure_update
  on public.booking_groups;

create trigger klyx_guard_group_payment_failure_update
before update of payment_status,
                 stripe_payment_intent_id,
                 payment_failure_code,
                 payment_failure_message,
                 payment_failed_at
on public.booking_groups
for each row
execute function public.klyx_guard_group_payment_failure_update();

comment on function public.klyx_guard_group_payment_failure_update() is
  'Fail-closed guard: stale Stripe failures cannot replace a newer booking-group payment attempt or mutate terminal payment state.';
