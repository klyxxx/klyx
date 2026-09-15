begin;

alter table public.transaction_risk_decisions
  drop constraint if exists transaction_risk_decisions_action_check;

alter table public.transaction_risk_decisions
  add constraint transaction_risk_decisions_action_check
  check (action in ('checkout_create', 'refund_create'));

comment on constraint transaction_risk_decisions_action_check
  on public.transaction_risk_decisions is
  'Transaction-scoped risk actions. refund_create protects customer refunds without turning provider-side Stripe identity issues into a global account suspension.';

commit;
