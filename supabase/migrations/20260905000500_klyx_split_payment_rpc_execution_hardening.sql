-- KLYX split-payment RPC execution hardening
--
-- These SECURITY DEFINER helpers are part of the server-side Stripe checkout
-- orchestration. Anonymous callers must never be able to claim, attach, or
-- release a split payment checkout directly.

revoke all on function public.klyx_claim_split_payment_unit_13_27(uuid, uuid, text) from public;
revoke all on function public.klyx_claim_split_payment_unit_13_27(uuid, uuid, text) from anon;
grant execute on function public.klyx_claim_split_payment_unit_13_27(uuid, uuid, text) to service_role;

revoke all on function public.klyx_attach_split_checkout_13_27(uuid, text, text, text) from public;
revoke all on function public.klyx_attach_split_checkout_13_27(uuid, text, text, text) from anon;
grant execute on function public.klyx_attach_split_checkout_13_27(uuid, text, text, text) to service_role;

revoke all on function public.klyx_release_split_checkout_13_27(uuid, text) from public;
revoke all on function public.klyx_release_split_checkout_13_27(uuid, text) from anon;
grant execute on function public.klyx_release_split_checkout_13_27(uuid, text) to service_role;

comment on function public.klyx_claim_split_payment_unit_13_27(uuid, uuid, text) is
  'Server-only split payment claim. Requires authenticated ownership to have been established by the calling KLYX API before service-role invocation.';

comment on function public.klyx_attach_split_checkout_13_27(uuid, text, text, text) is
  'Server-only CAS attachment of a Stripe Checkout session to the active split-payment attempt token.';

comment on function public.klyx_release_split_checkout_13_27(uuid, text) is
  'Server-only release of the exact active split-payment Checkout session.';
