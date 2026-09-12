-- KLYX production migration-history reconciliation preflight.
--
-- Production recorded a later one-off migration that removed the explicit
-- profiles_stripe_account_id_unique index while leaving the legacy *_key
-- equivalent in place. The already-committed 20260906084000 cleanup expects
-- both equivalent indexes before it removes *_key.
--
-- Recreate only the missing equivalent index before that historical cleanup.
-- This migration is intentionally positioned immediately before 06084000 and
-- fails closed if either same-name index has drifted from the expected unique
-- partial index on profiles(stripe_account_id).

begin;

create unique index if not exists profiles_stripe_account_id_key
  on public.profiles (stripe_account_id)
  where stripe_account_id is not null;

create unique index if not exists profiles_stripe_account_id_unique
  on public.profiles (stripe_account_id)
  where stripe_account_id is not null;

do $klyx_stripe_history_preflight$
declare
  legacy_oid oid := to_regclass('public.profiles_stripe_account_id_key');
  canonical_oid oid := to_regclass('public.profiles_stripe_account_id_unique');
  stripe_attnum smallint;
  indexes_drifted boolean;
begin
  select attribute.attnum
  into stripe_attnum
  from pg_attribute as attribute
  where attribute.attrelid = 'public.profiles'::regclass
    and attribute.attname = 'stripe_account_id'
    and not attribute.attisdropped;

  if stripe_attnum is null
     or legacy_oid is null
     or canonical_oid is null then
    raise exception 'KLYX_PROFILES_STRIPE_HISTORY_PREFLIGHT_INDEX_MISSING';
  end if;

  select
    legacy.indrelid <> 'public.profiles'::regclass
    or canonical.indrelid <> 'public.profiles'::regclass
    or legacy.indisunique is distinct from true
    or canonical.indisunique is distinct from true
    or legacy.indisvalid is distinct from true
    or canonical.indisvalid is distinct from true
    or legacy.indisready is distinct from true
    or canonical.indisready is distinct from true
    or legacy.indnkeyatts <> 1
    or canonical.indnkeyatts <> 1
    -- pg_index.indkey is int2vector. Comparing its array cast to a normal
    -- PostgreSQL array also compares array lower bounds (0 versus 1), which
    -- creates a false drift signal. Native vector text is dimension-agnostic
    -- and exact for this one-column index.
    or legacy.indkey::text <> stripe_attnum::text
    or canonical.indkey::text <> stripe_attnum::text
    or legacy.indclass::text <> canonical.indclass::text
    or legacy.indcollation::text <> canonical.indcollation::text
    or legacy.indoption::text <> canonical.indoption::text
    or pg_get_expr(legacy.indexprs, legacy.indrelid)
       is distinct from pg_get_expr(canonical.indexprs, canonical.indrelid)
    or pg_get_expr(legacy.indpred, legacy.indrelid)
       is distinct from pg_get_expr(canonical.indpred, canonical.indrelid)
    or pg_get_expr(legacy.indpred, legacy.indrelid)
       is distinct from '(stripe_account_id IS NOT NULL)'
  into indexes_drifted
  from pg_index as legacy
  cross join pg_index as canonical
  where legacy.indexrelid = legacy_oid
    and canonical.indexrelid = canonical_oid;

  if indexes_drifted is distinct from false then
    raise exception 'KLYX_PROFILES_STRIPE_HISTORY_PREFLIGHT_INDEX_DRIFT';
  end if;
end;
$klyx_stripe_history_preflight$;

commit;
