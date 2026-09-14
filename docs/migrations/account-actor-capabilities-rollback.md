# Rollback — canonical account actor capabilities

Migration: `20260914121500_klyx_account_actor_capabilities.sql`

## Principle

This migration is additive. Rollback is therefore **code/policy rollback, not data deletion**.

Do not drop or rewrite:

- `accounts`;
- `account_actor_capabilities`;
- `account_capability_qualifications`;
- `profiles.account_id`, `profiles.account_type`, `profiles.current_mode` or `profiles.role`;
- bookings, quotes, missions or historical profile identifiers;
- Stripe account/payment identifiers;
- provider qualification/history rows.

The capability rows are durable user/business state and must survive an application rollback.

## Safe rollback order

1. Roll the application back to the immediately preceding release so legacy consumers again read their historical compatibility fields.
2. Stop writes to `/api/account/capabilities` while the old release is active.
3. Keep both account-level capability tables and every row intact.
4. If database policy rollback is required, restore the preceding `profiles` SELECT policies and the preceding `klyx_public_provider_service(uuid)` implementation from migration history. Do not alter account/profile IDs.
5. Keep the canonical `profiles.account_id -> accounts.id` binding from the unique-account foundation.
6. Re-run Security, unit/integration tests, TypeScript, production build, Golden Path and exact Playwright before accepting the rollback head.

## Divergence inventory

This query is diagnostic only:

```sql
select
  account.id as account_id,
  account.auth_user_id,
  bool_or(
    capability.capability = 'request_services'
    and capability.enabled
  ) as can_request_services,
  bool_or(
    capability.capability = 'offer_services'
    and capability.enabled
  ) as can_offer_services,
  array_agg(distinct profile.account_type)
    filter (where profile.account_type is not null) as legacy_account_types
from public.accounts as account
left join public.account_actor_capabilities as capability
  on capability.account_id = account.id
left join public.profiles as profile
  on profile.account_id = account.id
group by account.id, account.auth_user_id;
```

Do **not** use this output to rewrite legacy roles automatically. One account may legitimately have both canonical capabilities even when no single legacy discriminator can represent that state.

## Forward recovery

Preferred recovery is forward: correct the capability reader, RLS/policy adapter or compatibility adapter, then keep the existing account-level rows. Because the migration does not remap booking, payment, Stripe or historical profile identifiers, no transactional reconciliation is required by this migration itself.
