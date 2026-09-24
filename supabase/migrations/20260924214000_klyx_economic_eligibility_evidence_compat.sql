-- KLYX economic eligibility audit compatibility.
--
-- The pure eligibility engine emits provider-neutral evidence keys.
-- Existing certification/operations consumers still read the historical
-- Stripe-specific evidence names. Preserve those names as aliases at the
-- persistence boundary without allowing SQL to recalculate eligibility.
--
-- Canonical authority remains:
--   source facts -> pure TypeScript engine -> decision/evidence -> ledger.
-- This trigger only copies evidence values already computed by the engine.

create or replace function public.klyx_economic_eligibility_evidence_compat()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.evidence_snapshot := coalesce(new.evidence_snapshot, '{}'::jsonb);

  if new.evidence_snapshot ? 'externalTransferCapabilityStatus'
     and not (new.evidence_snapshot ? 'stripeTransferCapabilityStatus') then
    new.evidence_snapshot := jsonb_set(
      new.evidence_snapshot,
      '{stripeTransferCapabilityStatus}',
      new.evidence_snapshot -> 'externalTransferCapabilityStatus',
      true
    );
  end if;

  if new.evidence_snapshot ? 'externalTransferCapabilityActive'
     and not (new.evidence_snapshot ? 'stripeTransferCapabilityActive') then
    new.evidence_snapshot := jsonb_set(
      new.evidence_snapshot,
      '{stripeTransferCapabilityActive}',
      new.evidence_snapshot -> 'externalTransferCapabilityActive',
      true
    );
  end if;

  return new;
end;
$$;

revoke all on function public.klyx_economic_eligibility_evidence_compat() from public;
revoke all on function public.klyx_economic_eligibility_evidence_compat() from anon;
revoke all on function public.klyx_economic_eligibility_evidence_compat() from authenticated;

drop trigger if exists klyx_economic_eligibility_evidence_compat
  on public.economic_settlement_eligibility_decisions;

create trigger klyx_economic_eligibility_evidence_compat
before insert on public.economic_settlement_eligibility_decisions
for each row
execute function public.klyx_economic_eligibility_evidence_compat();

comment on function public.klyx_economic_eligibility_evidence_compat() is
  'Copies provider-neutral settlement capability evidence into historical Stripe-named audit aliases. Does not calculate or alter eligibility decisions.';
