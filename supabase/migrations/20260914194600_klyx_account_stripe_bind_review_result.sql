-- ============================================================
-- KLYX ACCOUNT STRIPE BIND — ATOMIC REVIEW RESULT
--
-- Replaces the initial void binder with a status-returning server-only RPC.
-- A conflict is persisted as review_required in the same transaction instead
-- of raising after writes (which would roll those writes back).
-- ============================================================

begin;

drop function if exists public.klyx_bind_account_stripe_connect(uuid, text);

create function public.klyx_bind_account_stripe_connect(
  p_account_id uuid,
  p_stripe_account_id text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  canonical public.accounts%rowtype;
  legacy_ids text[];
  legacy_profile_ids uuid[];
  conflict_reason text;
begin
  if p_stripe_account_id is null
     or btrim(p_stripe_account_id) = ''
     or p_stripe_account_id !~ '^acct_[A-Za-z0-9]+$' then
    raise exception using
      errcode = '23514',
      message = 'KLYX_STRIPE_CONNECT_ACCOUNT_ID_INVALID';
  end if;

  select *
  into canonical
  from public.accounts
  where id = p_account_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'KLYX_CANONICAL_ACCOUNT_NOT_FOUND';
  end if;

  select
    coalesce(
      array_agg(distinct profile.stripe_account_id order by profile.stripe_account_id)
        filter (where profile.stripe_account_id is not null),
      '{}'::text[]
    ),
    coalesce(
      array_agg(profile.id order by profile.id)
        filter (where profile.stripe_account_id is not null),
      '{}'::uuid[]
    )
  into legacy_ids, legacy_profile_ids
  from public.profiles as profile
  where profile.account_id = p_account_id;

  conflict_reason := case
    when canonical.stripe_connect_state = 'review_required'
      then 'canonical_account_already_requires_review'
    when cardinality(legacy_ids) > 1
      then 'multiple_legacy_stripe_accounts'
    when cardinality(legacy_ids) = 1
      and legacy_ids[1] is distinct from p_stripe_account_id
      then 'requested_stripe_account_differs_from_legacy_identity'
    when canonical.stripe_account_id is not null
      and canonical.stripe_account_id is distinct from p_stripe_account_id
      then 'requested_stripe_account_differs_from_canonical_identity'
    when exists (
      select 1
      from public.accounts as other_account
      where other_account.id <> p_account_id
        and other_account.stripe_account_id = p_stripe_account_id
    ) then 'stripe_account_linked_to_other_canonical_account'
    else null
  end;

  if conflict_reason is not null then
    update public.accounts
    set stripe_connect_state = 'review_required'
    where id = p_account_id;

    insert into public.stripe_connect_identity_reviews (
      account_id,
      reason,
      candidate_stripe_account_ids,
      source_profile_ids
    )
    values (
      p_account_id,
      conflict_reason,
      case
        when p_stripe_account_id = any(legacy_ids)
          then legacy_ids
        else array_append(legacy_ids, p_stripe_account_id)
      end,
      legacy_profile_ids
    )
    on conflict (account_id) where status = 'pending'
    do update set
      reason = excluded.reason,
      candidate_stripe_account_ids = excluded.candidate_stripe_account_ids,
      source_profile_ids = excluded.source_profile_ids,
      updated_at = now();

    return 'review_required';
  end if;

  update public.accounts
  set
    stripe_account_id = p_stripe_account_id,
    stripe_connect_state = 'linked',
    stripe_status_updated_at = now()
  where id = p_account_id;

  return 'linked';
end;
$function$;

alter function public.klyx_bind_account_stripe_connect(uuid, text)
  owner to postgres;
revoke all on function public.klyx_bind_account_stripe_connect(uuid, text)
  from public, anon, authenticated;
grant execute on function public.klyx_bind_account_stripe_connect(uuid, text)
  to service_role;

commit;
