-- ============================================================
-- KLYX ACCOUNT-LEVEL STRIPE CONNECT IDENTITY
--
-- Financial identity belongs to public.accounts, not to a permanent
-- client/provider profile. Legacy profiles.stripe_account_id remains untouched
-- as a compatibility/history surface during the additive migration.
--
-- Safety invariants:
-- - one canonical Connect identity per KLYX account;
-- - one Connect account cannot be claimed by two KLYX accounts;
-- - ambiguous or contradictory historical identities are recorded as conflict;
-- - no payment, booking, payout, refund or webhook history is rewritten.
-- ============================================================

begin;

create table if not exists public.account_stripe_connect_identities (
  account_id uuid primary key
    references public.accounts(id)
    on delete cascade,
  stripe_account_id text,
  identity_state text not null,
  source_profile_ids uuid[] not null default '{}'::uuid[],
  conflicting_stripe_account_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint account_stripe_connect_identity_state_check
    check (identity_state in ('linked', 'conflict')),
  constraint account_stripe_connect_identity_shape_check
    check (
      (
        identity_state = 'linked'
        and stripe_account_id is not null
        and cardinality(conflicting_stripe_account_ids) = 0
      )
      or
      (
        identity_state = 'conflict'
        and stripe_account_id is null
        and cardinality(conflicting_stripe_account_ids) > 0
      )
    )
);

comment on table public.account_stripe_connect_identities is
  'Canonical account-level Stripe Connect identity. Legacy profile Stripe fields remain compatibility/history only.';
comment on column public.account_stripe_connect_identities.identity_state is
  'linked = one unambiguous canonical Stripe account; conflict = contradictory Stripe identity evidence, fail closed pending human review.';
comment on column public.account_stripe_connect_identities.source_profile_ids is
  'Historical profile ids that contributed Stripe identity evidence. Never used as the canonical owner.';
comment on column public.account_stripe_connect_identities.conflicting_stripe_account_ids is
  'Stripe account ids involved in identity evidence that cannot be safely canonicalized automatically.';

create unique index if not exists account_stripe_connect_stripe_account_unique
  on public.account_stripe_connect_identities (stripe_account_id)
  where stripe_account_id is not null;

create index if not exists account_stripe_connect_identity_state_idx
  on public.account_stripe_connect_identities (identity_state);

alter table public.account_stripe_connect_identities enable row level security;
revoke all privileges on table public.account_stripe_connect_identities
  from public, anon, authenticated;
grant all privileges on table public.account_stripe_connect_identities
  to service_role;

-- Unambiguous historical evidence is linked only when it does not contradict an
-- already linked canonical id. Contradiction transitions to conflict instead of
-- silently retaining or replacing either identity.
with historical as (
  select
    profile.account_id,
    array_agg(distinct profile.id order by profile.id) as source_profile_ids,
    array_agg(distinct profile.stripe_account_id order by profile.stripe_account_id)
      filter (where profile.stripe_account_id is not null) as stripe_account_ids
  from public.profiles as profile
  where profile.account_id is not null
  group by profile.account_id
), unambiguous as (
  select
    account_id,
    source_profile_ids,
    stripe_account_ids[1] as stripe_account_id
  from historical
  where cardinality(stripe_account_ids) = 1
)
insert into public.account_stripe_connect_identities (
  account_id,
  stripe_account_id,
  identity_state,
  source_profile_ids,
  conflicting_stripe_account_ids
)
select
  account_id,
  stripe_account_id,
  'linked',
  source_profile_ids,
  '{}'::text[]
from unambiguous
on conflict (account_id) do update
set
  stripe_account_id = case
    when public.account_stripe_connect_identities.identity_state = 'linked'
      and public.account_stripe_connect_identities.stripe_account_id = excluded.stripe_account_id
      then excluded.stripe_account_id
    else null
  end,
  identity_state = case
    when public.account_stripe_connect_identities.identity_state = 'linked'
      and public.account_stripe_connect_identities.stripe_account_id = excluded.stripe_account_id
      then 'linked'
    when public.account_stripe_connect_identities.identity_state = 'conflict'
      then 'conflict'
    else 'conflict'
  end,
  source_profile_ids = (
    select array_agg(distinct value order by value)
    from unnest(
      public.account_stripe_connect_identities.source_profile_ids || excluded.source_profile_ids
    ) as value
  ),
  conflicting_stripe_account_ids = case
    when public.account_stripe_connect_identities.identity_state = 'linked'
      and public.account_stripe_connect_identities.stripe_account_id = excluded.stripe_account_id
      then '{}'::text[]
    else (
      select array_agg(distinct value order by value)
      from unnest(
        array_remove(
          public.account_stripe_connect_identities.conflicting_stripe_account_ids
            || array[public.account_stripe_connect_identities.stripe_account_id, excluded.stripe_account_id],
          null
        )
      ) as value
    )
  end,
  updated_at = now();

-- Multiple distinct historical Stripe accounts for one canonical KLYX account
-- are never resolved automatically. Persist every identifier for manual review,
-- even if an earlier run had already linked a different canonical id.
with historical as (
  select
    profile.account_id,
    array_agg(distinct profile.id order by profile.id) as source_profile_ids,
    array_agg(distinct profile.stripe_account_id order by profile.stripe_account_id)
      filter (where profile.stripe_account_id is not null) as stripe_account_ids
  from public.profiles as profile
  where profile.account_id is not null
  group by profile.account_id
), ambiguous as (
  select account_id, source_profile_ids, stripe_account_ids
  from historical
  where cardinality(stripe_account_ids) > 1
)
insert into public.account_stripe_connect_identities (
  account_id,
  stripe_account_id,
  identity_state,
  source_profile_ids,
  conflicting_stripe_account_ids
)
select
  account_id,
  null,
  'conflict',
  source_profile_ids,
  stripe_account_ids
from ambiguous
on conflict (account_id) do update
set
  stripe_account_id = null,
  identity_state = 'conflict',
  source_profile_ids = (
    select array_agg(distinct value order by value)
    from unnest(
      public.account_stripe_connect_identities.source_profile_ids || excluded.source_profile_ids
    ) as value
  ),
  conflicting_stripe_account_ids = (
    select array_agg(distinct value order by value)
    from unnest(
      array_remove(
        public.account_stripe_connect_identities.conflicting_stripe_account_ids
          || excluded.conflicting_stripe_account_ids
          || array[public.account_stripe_connect_identities.stripe_account_id],
        null
      )
    ) as value
  ),
  updated_at = now();

commit;
