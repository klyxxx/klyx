-- KLYX_PROFILES_STRIPE_DUPLICATE_INDEX_CLEANUP
--
-- profiles_stripe_account_id_key and profiles_stripe_account_id_unique are
-- identical partial unique indexes on profiles(stripe_account_id).
-- Keep the explicit canonical *_unique index and remove only the redundant
-- legacy *_key index without changing Stripe uniqueness semantics.

begin;

do $klyx_profiles_stripe_index_cleanup$
declare
  legacy_oid oid := to_regclass('public.profiles_stripe_account_id_key');
  canonical_oid oid := to_regclass('public.profiles_stripe_account_id_unique');
  indexes_drifted boolean;
begin
  if legacy_oid is null or canonical_oid is null then
    raise exception 'KLYX_PROFILES_STRIPE_INDEX_MISSING';
  end if;

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
  from pg_index legacy
  cross join pg_index canonical
  where legacy.indexrelid = legacy_oid
    and canonical.indexrelid = canonical_oid;

  if indexes_drifted is distinct from false then
    raise exception 'KLYX_PROFILES_STRIPE_INDEX_DRIFT';
  end if;

  if not exists (
    select 1
    from pg_index canonical
    where canonical.indexrelid = canonical_oid
      and canonical.indisunique
      and canonical.indisvalid
      and canonical.indisready
  ) then
    raise exception 'KLYX_PROFILES_STRIPE_CANONICAL_INDEX_INVALID';
  end if;
end;
$klyx_profiles_stripe_index_cleanup$;

drop index public.profiles_stripe_account_id_key;

do $klyx_profiles_stripe_index_verify$
begin
  if to_regclass('public.profiles_stripe_account_id_key') is not null then
    raise exception 'KLYX_PROFILES_STRIPE_LEGACY_INDEX_STILL_PRESENT';
  end if;

  if not exists (
    select 1
    from pg_index canonical
    where canonical.indexrelid = to_regclass('public.profiles_stripe_account_id_unique')
      and canonical.indisunique
      and canonical.indisvalid
      and canonical.indisready
  ) then
    raise exception 'KLYX_PROFILES_STRIPE_CANONICAL_INDEX_INVALID_AFTER_CLEANUP';
  end if;
end;
$klyx_profiles_stripe_index_verify$;

commit;
