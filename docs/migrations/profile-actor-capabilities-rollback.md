# Rollback — profile actor capabilities

Migration: `20260912230000_klyx_profile_actor_capabilities.sql`

## Principle

This migration is additive. A rollback must therefore be additive/non-destructive too. Do **not** drop `profiles.role`, `profiles.current_mode`, `profiles.account_type`, `profile_actor_capabilities`, booking foreign keys, Stripe identifiers, provider records, or capability history as part of an emergency rollback.

## Safe rollback order

1. Roll the application back to the previous release so authorization reads the legacy `account_type` discriminator again.
2. Stop writes to `/api/profiles/capabilities` while the old application release is active.
3. Keep `profile_actor_capabilities` and its rows in place. They are ignored by the old release and preserve every user choice for a later forward fix.
4. If database policy rollback is required, restore the previous `profiles` SELECT predicates (`account_type = 'provider'` plus published `provider_profiles`) and the previous `klyx_public_provider_service` body from the immediately preceding migration state. Do not alter any booking/payment table.
5. Re-run Security, TypeScript, build and exact Playwright verification before serving traffic from the rollback release.

## Dual-capability caveat

Profiles changed after this migration can legitimately have both `request_services` and `offer_services`. The legacy discriminator cannot represent both. During a code rollback those profiles temporarily fall back to their pre-existing `account_type`; this is a controlled feature degradation, not a data migration. Do not attempt to rewrite `account_type` automatically to emulate both capabilities.

Before a database-policy rollback, inventory divergent profiles for support/recovery:

```sql
select
  profile.id,
  profile.account_type,
  bool_or(capability.capability = 'request_services' and capability.enabled) as can_request_services,
  bool_or(capability.capability = 'offer_services' and capability.enabled) as can_offer_services
from public.profiles as profile
left join public.profile_actor_capabilities as capability
  on capability.profile_id = profile.id
group by profile.id, profile.account_type;
```

This query is diagnostic only. Do not use its output to mutate legacy roles automatically.

## Forward recovery

Preferred recovery is forward: fix the capability reader/policy, deploy it, then keep the existing capability rows. Because profile ids, bookings, provider data and Stripe ids were never remapped, no transactional reconciliation is required by this migration itself.
