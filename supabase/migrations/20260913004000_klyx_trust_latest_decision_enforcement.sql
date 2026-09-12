-- ============================================================
-- KLYX TRUST LATEST-DECISION ENFORCEMENT
--
-- Human review can append a replacement eligibility decision. Enforcement must
-- therefore evaluate the latest exact-scope decision first; it must never
-- search backwards for an older still-unexpired `eligible` result after a
-- newer adverse or expired decision exists.
-- ============================================================

begin;

create or replace function public.klyx_enforce_booking_trust_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  mission_context public.trust_mission_contexts%rowtype;
  performer_profile_id uuid;
  performer_account_id uuid;
  latest_decision public.trust_eligibility_decisions%rowtype;
begin
  if new.status is distinct from 'accepted'
     or old.status is not distinct from 'accepted' then
    return new;
  end if;

  select context.*
  into mission_context
  from public.trust_mission_contexts as context
  where context.booking_id = new.id;

  if not found or mission_context.enforcement_mode <> 'enforce' then
    return new;
  end if;

  performer_profile_id := coalesce(new.provider_id, new.babysitter_id);

  if performer_profile_id is null then
    raise exception using
      errcode = '23514',
      message = 'KLYX_TRUST_PERFORMER_REQUIRED';
  end if;

  select profile.account_id
  into performer_account_id
  from public.profiles as profile
  where profile.id = performer_profile_id;

  if performer_account_id is null then
    raise exception using
      errcode = '23514',
      message = 'KLYX_TRUST_ACCOUNT_REQUIRED';
  end if;

  select decision.*
  into latest_decision
  from public.trust_eligibility_decisions as decision
  where decision.account_id = performer_account_id
    and decision.policy_id = mission_context.policy_id
    and decision.target_type = 'booking'
    and decision.target_ref = new.id::text
    and decision.category_key = mission_context.category_key
    and decision.jurisdiction_code = mission_context.jurisdiction_code
  order by decision.created_at desc, decision.id desc
  limit 1;

  if not found
     or latest_decision.decision not in ('eligible', 'eligible_with_conditions')
     or (
       latest_decision.human_review_required = true
       and latest_decision.review_status <> 'approved'
     )
     or (
       latest_decision.expires_at is not null
       and latest_decision.expires_at <= now()
     ) then
    raise exception using
      errcode = '23514',
      message = 'KLYX_TRUST_ELIGIBILITY_REQUIRED';
  end if;

  return new;
end;
$$;

alter function public.klyx_enforce_booking_trust_eligibility()
  owner to postgres;
revoke all on function public.klyx_enforce_booking_trust_eligibility()
  from public, anon, authenticated;
grant execute on function public.klyx_enforce_booking_trust_eligibility()
  to service_role;

commit;
