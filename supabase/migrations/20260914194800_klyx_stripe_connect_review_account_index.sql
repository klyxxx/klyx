-- KLYX Stripe Connect review queue performance guard.
-- Additive only: no financial row or Stripe identity is rewritten.

begin;

create index if not exists stripe_connect_identity_reviews_account_idx
  on public.stripe_connect_identity_reviews (account_id);

commit;
