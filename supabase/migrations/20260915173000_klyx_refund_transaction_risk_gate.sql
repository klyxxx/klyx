begin;

alter table public.transaction_risk_decisions
  drop constraint if exists transaction_risk_decisions_action_check;

alter table public.transaction_risk_decisions
  add constraint transaction_risk_decisions_action_check
  check (action in ('checkout_create', 'refund_create'));

alter table public.transaction_risk_decisions
  drop constraint if exists transaction_risk_decisions_participant_check;

alter table public.transaction_risk_decisions
  add constraint transaction_risk_decisions_participant_check
  check (
    participant in (
      'payer',
      'recipient',
      'requester',
      'refund_recipient'
    )
  );

comment on table public.transaction_risk_decisions is
  'Server-only canonical KLYX transaction-risk preflight decisions for checkout and refund creation. This table does not represent a permanent account suspension.';

commit;
