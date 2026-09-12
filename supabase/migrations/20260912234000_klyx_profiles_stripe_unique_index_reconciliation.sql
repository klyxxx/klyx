-- KLYX canonical Stripe profile-index reconciliation.
--
-- Fresh databases replay the historical 20260906140329 production migration,
-- which removed profiles_stripe_account_id_unique. Production already has that
-- historical version recorded and therefore skips it. Normalize both paths here
-- to one final schema: exactly the explicit canonical *_unique index remains.

begin;

create unique index if not exists profiles_stripe_account_id_unique
  on public.profiles (stripe_account_id)
  where stripe_account_id is not null;

do $klyx_profiles_stripe_reconcile$
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

  if stripe_attnum is null or canonical_oid is null then
    raise exception 'KLYX_PROFILES_STRIPE_RECONCILIATION_CANONICAL_MISSING';
  end if;

  if not exists (
    select 1
    from pg_index as canonical
    where canonical.indexrelid = canonical_oid
      and canonical.indrelid = 'public.profiles'::regclass
      and canonical.indisunique
      and canonical.indisvalid
      and canonical.indisready
      and canonical.indnkeyatts = 1
      and canonical.indkey::text = stripe_attnum::text
      and pg_get_expr(canonical.indexprs, canonical.indrelid) is null
      and pg_get_expr(canonical.indpred, canonical.indrelid)
          = '(stripe_account_id IS NOT NULL)'
  ) then
    raise exception 'KLYX_PROFILES_STRIPE_RECONCILIATION_CANONICAL_DRIFT';
  end if;

  if legacy_oid is not null then
    select
      legacy.indrelid <> canonical.indrelid
      or legacy.indisunique <> canonical.indisunique
      or legacy.indisvalid <> canonical.indisvalid
      or legacy.indisready <> canonical.indisready
      or legacy.indkey::text <> canonical.indkey::text
      or legacy.indclass::text <> canonical.indclass::text
      or legacy.indcollation::text <> canonical.indcollation::text
      or legacy.indoption::text <> canonical.indoption::text
      or pg_get_expr(legacy.indexprs, legacy.indrelid)
         is distinct from pg_get_expr(canonical.indexprs, canonical.indrelid)
      or pg_get_expr(legacy.indpred, legacy.indrelid)
         is distinct from pg_get_expr(canonical.indpred, canonical.indrelid)
    into indexes_drifted
    from pg_index as legacy
    cross join pg_index as canonical
    where legacy.indexrelid = legacy_oid
      and canonical.indexrelid = canonical_oid;

    if indexes_drifted is distinct from false then
      raise exception 'KLYX_PROFILES_STRIPE_RECONCILIATION_LEGACY_DRIFT';
    end if;

    drop index public.profiles_stripe_account_id_key;
  end if;
end;
$klyx_profiles_stripe_reconcile$;

do $klyx_profiles_stripe_reconcile_verify$
begin
  if to_regclass('public.profiles_stripe_account_id_key') is not null then
    raise exception 'KLYX_PROFILES_STRIPE_RECONCILIATION_LEGACY_REMAINS';
  end if;

  if not exists (
    select 1
    from pg_index as canonical
    where canonical.indexrelid = to_regclass('public.profiles_stripe_account_id_unique')
      and canonical.indisunique
      and canonical.indisvalid
      and canonical.indisready
  ) then
    raise exception 'KLYX_PROFILES_STRIPE_RECONCILIATION_FINAL_INVALID';
  end if;
end;
$klyx_profiles_stripe_reconcile_verify$;

commit;
