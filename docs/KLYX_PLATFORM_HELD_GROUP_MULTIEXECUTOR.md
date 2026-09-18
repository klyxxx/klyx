# KLYX Platform-Held multi-executor Group Settlement — Stripe TEST only

## Scope

This settlement model is for the existing KLYX multi-provider split batch:
`split_booking_batches` + `split_booking_batch_items`.

It is **not** the historical `booking_groups` model, which is mono-provider.

It is separate from the certified single-booking `booking_settlements` engine.

## Charge authority

One KLYX-platform Stripe charge finances exactly one frozen multi-executor
settlement parent.

The parent freezes:

- batch id;
- client profile;
- payment confirmation and plan hash;
- gross amount;
- KLYX commission;
- total provider funds;
- currency;
- one `transfer_group`;
- Checkout Session;
- PaymentIntent;
- source Charge.

Every executor Transfer MUST use:

- the same parent `transfer_group`;
- `source_transaction = parent.stripe_charge_id`;
- the executor's frozen canonical Stripe account;
- the executor's exact frozen provider amount.

A Transfer associated with the group but not matching this immutable truth is a
financial divergence and fails closed.

## Frozen executor ledger

Each executor receives one immutable settlement member containing:

- canonical provider profile id;
- canonical KLYX account id;
- canonical Stripe recipient account id;
- exact child booking ids;
- gross amount;
- KLYX commission;
- provider amount;
- currency.

For every member:

`member_gross = member_KLYX_commission + member_provider_amount`

For the parent:

`sum(member_gross) = parent_gross`

`sum(member_KLYX_commission) = parent_KLYX_commission`

`sum(member_provider_amount) = parent_provider_funds`

`parent_gross = parent_KLYX_commission + parent_provider_funds`

All values are integer cents.

## Individual release

An executor becomes releasable only when all child bookings assigned to that
executor are completed.

Before any new Stripe Transfer:

1. KLYX reads all Transfers for the parent `transfer_group`;
2. every remote Transfer is validated against frozen member truth;
3. an existing valid member Transfer is reconciled instead of recreated;
4. account-first transaction risk is re-evaluated;
5. canonical Stripe identity is re-checked;
6. Stripe recipient transfer capability is re-checked;
7. the SQL claim locks the parent row and the member row;
8. active sibling claims and already persisted Transfers are included in the
   committed-provider-funds total;
9. Stripe truth is read again after the claim;
10. aggregate remote capacity is checked immediately before the Stripe write.

The idempotency key is member-specific. An unknown Stripe response leaves the
member claim unresolved; a later pass searches Stripe truth before another
write.

## Concurrent releases

Multiple executors may become releasable concurrently.

The parent database row is the serialization barrier for claims. Therefore:

`persisted_or_claimed_provider_funds <= parent_provider_funds`

The remote Stripe guard additionally requires:

`sum(valid_remote_transfers) + requested_member_transfer <= parent_provider_funds`

No group release may over-transfer the provider funds financed by the charge.

## Failure isolation

Member release state is independent.

A failed or review-required executor does not rewrite a sibling's released
settlement. A member-specific Stripe capability, identity, risk, or Transfer
problem affects only that member unless Stripe truth for the shared parent
charge itself is divergent.

## Refunds

### Partial refund

The client supplies only:

- a request key;
- total gross refund amount;
- member id(s);
- gross refund cents allocated to each member.

The client does **not** choose the KLYX-commission/provider split.

KLYX derives each partial allocation from frozen economics using a cumulative
nearest-cent rule:

`target_fee(R) = round(member_fee * cumulative_refunded_gross / member_gross)`

The current refund receives only the delta from the previous cumulative target.

This prevents penny drift across repeated partial refunds and guarantees that a
full cumulative refund returns exactly the frozen member commission and provider
amount.

The database independently enforces the same cumulative policy.

### Total refund

A total refund automatically allocates every remaining frozen cent across all
members.

After completion:

`sum(member_refunded_gross) = parent_gross`

`parent_refunded = parent_gross`

### Individual reversal

If an executor already received a Transfer and a refund allocation includes a
positive provider portion, that member's Transfer is reversed before the
customer refund.

Each refund allocation has its own idempotent reversal key.

An executor that never received a Transfer requires no reversal.

For every member:

`cumulative_reversed <= member_provider_amount`

For the group:

`cumulative_customer_refunds <= parent_gross`

## Refund retry truth

A refund `requestKey` identifies an already frozen refund plan before KLYX
recalculates new money.

A repeated partial request with a different member/gross allocation is rejected
as a request-key conflict.

A terminal total refund may be retried with the same request key even after the
parent is already `refunded`; it reconciles the existing Stripe/KLYX truth and
does not create another refund.

## Stripe environment

This feature is TEST-only.

- `sk_live_*` is rejected.
- `sk_test_*` is required for new group charge/Transfer/reversal/refund paths.
- `KLYX_STRIPE_SETTLEMENT_MODE=platform_held` must be explicitly armed.
- no payout API is used.
- no Vercel deployment is part of certification.

## Independent certification

The merge candidate must pass on one immutable SHA:

- unit/integration tests;
- TypeScript;
- production build;
- Security;
- Provider Storage;
- Golden Path;
- Performance;
- exact PR-native Playwright E2E + UX/Visual;
- real Stripe TEST network proof covering:
  - one platform charge;
  - exact frozen member accounting;
  - shared `transfer_group`;
  - shared `source_transaction`;
  - two successful concurrent member releases;
  - aggregate no-over-transfer;
  - isolated member failure;
  - idempotent release replay;
  - partial refund;
  - total refund;
  - individual reversal;
  - idempotent refund replay.

Live activation remains out of scope.
