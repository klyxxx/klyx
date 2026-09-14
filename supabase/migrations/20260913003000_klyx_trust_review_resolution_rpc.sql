-- ============================================================
-- KLYX TRUST DECISION REVIEW RESOLUTION
--
-- Atomic server-only resolution for human review / appeal records.
-- The application authorizes the reviewer first; this function keeps the
-- database transition itself consistent and preserves decision history.
-- ============================================================

begin;

create or replace function public.klyx_resolve_trust_decision_review(
  p_review_id uuid,
  p_reviewer_auth_user_id uuid,
  p_action text,
  p_rationale text,
  p_replacement_decision text default null,
  p_reason_codes jsonb default '[]'::jsonb,
  p_required_actions jsonb default '[]'::jsonb,
  p_explanation text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  review_row public.trust_decision_reviews%rowtype;
  decision_row public.trust_eligibility_decisions%rowtype;
  v_outcome_decision_id uuid;
  replacement_human_review_required boolean;
  replacement_review_status text;
begin
  if p_reviewer_auth_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'KLYX_TRUST_REVIEWER_REQUIRED';
  end if;

  if p_action not in ('uphold', 'replace') then
    raise exception using
      errcode = '22023',
      message = 'KLYX_TRUST_REVIEW_ACTION_INVALID';
  end if;

  if p_rationale is null or char_length(trim(p_rationale)) < 5 then
    raise exception using
      errcode = '22023',
      message = 'KLYX_TRUST_REVIEW_RATIONALE_REQUIRED';
  end if;

  if jsonb_typeof(p_reason_codes) <> 'array'
     or jsonb_typeof(p_required_actions) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'KLYX_TRUST_REVIEW_PAYLOAD_INVALID';
  end if;

  select review.*
  into review_row
  from public.trust_decision_reviews as review
  where review.id = p_review_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'KLYX_TRUST_REVIEW_NOT_FOUND';
  end if;

  if review_row.status not in ('requested', 'in_progress') then
    raise exception using
      errcode = '23514',
      message = 'KLYX_TRUST_REVIEW_ALREADY_RESOLVED';
  end if;

  select decision.*
  into decision_row
  from public.trust_eligibility_decisions as decision
  where decision.id = review_row.decision_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'KLYX_TRUST_DECISION_NOT_FOUND';
  end if;

  if p_action = 'uphold' then
    v_outcome_decision_id := decision_row.id;

    update public.trust_eligibility_decisions
    set review_status = case
      when human_review_required then 'rejected'
      else review_status
    end
    where id = decision_row.id;

    update public.trust_decision_reviews
    set
      status = 'upheld',
      reviewer_auth_user_id = p_reviewer_auth_user_id,
      rationale = trim(p_rationale),
      outcome_decision_id = v_outcome_decision_id,
      started_at = coalesce(started_at, now()),
      completed_at = now()
    where id = review_row.id;

    return v_outcome_decision_id;
  end if;

  if p_replacement_decision is null
     or p_replacement_decision not in (
       'eligible',
       'eligible_with_conditions',
       'requirements_missing',
       'human_review_required',
       'ineligible'
     ) then
    raise exception using
      errcode = '22023',
      message = 'KLYX_TRUST_REPLACEMENT_DECISION_INVALID';
  end if;

  if p_explanation is null
     or char_length(trim(p_explanation)) < 10
     or char_length(trim(p_explanation)) > 4000 then
    raise exception using
      errcode = '22023',
      message = 'KLYX_TRUST_REPLACEMENT_EXPLANATION_REQUIRED';
  end if;

  if decision_row.expires_at is not null
     and decision_row.expires_at <= now() then
    raise exception using
      errcode = '23514',
      message = 'KLYX_TRUST_DECISION_EXPIRED';
  end if;

  replacement_human_review_required :=
    p_replacement_decision = 'human_review_required';
  replacement_review_status := case
    when replacement_human_review_required then 'pending'
    else 'not_required'
  end;

  insert into public.trust_eligibility_decisions (
    account_id,
    policy_id,
    legal_assessment_id,
    target_type,
    target_ref,
    category_key,
    jurisdiction_code,
    decision,
    legal_pathway,
    decision_source,
    human_review_required,
    review_status,
    reason_codes,
    required_actions,
    explanation,
    input_snapshot,
    supersedes_id,
    expires_at
  )
  values (
    decision_row.account_id,
    decision_row.policy_id,
    decision_row.legal_assessment_id,
    decision_row.target_type,
    decision_row.target_ref,
    decision_row.category_key,
    decision_row.jurisdiction_code,
    p_replacement_decision,
    decision_row.legal_pathway,
    'human',
    replacement_human_review_required,
    replacement_review_status,
    p_reason_codes,
    p_required_actions,
    trim(p_explanation),
    jsonb_build_object(
      'review_of_decision_id', decision_row.id,
      'review_id', review_row.id
    ),
    decision_row.id,
    decision_row.expires_at
  )
  returning id into v_outcome_decision_id;

  update public.trust_eligibility_decisions
  set review_status = 'approved'
  where id = decision_row.id
    and human_review_required = true;

  update public.trust_decision_reviews
  set
    status = case
      when p_replacement_decision = decision_row.decision then 'modified'
      else 'overturned'
    end,
    reviewer_auth_user_id = p_reviewer_auth_user_id,
    rationale = trim(p_rationale),
    outcome_decision_id = v_outcome_decision_id,
    started_at = coalesce(started_at, now()),
    completed_at = now()
  where id = review_row.id;

  return v_outcome_decision_id;
end;
$$;

comment on function public.klyx_resolve_trust_decision_review(
  uuid, uuid, text, text, text, jsonb, jsonb, text
) is
  'Server-only atomic human review resolution. Replacement outcomes append a new eligibility decision instead of overwriting the original decision.';

alter function public.klyx_resolve_trust_decision_review(
  uuid, uuid, text, text, text, jsonb, jsonb, text
) owner to postgres;

revoke all on function public.klyx_resolve_trust_decision_review(
  uuid, uuid, text, text, text, jsonb, jsonb, text
) from public, anon, authenticated;

grant execute on function public.klyx_resolve_trust_decision_review(
  uuid, uuid, text, text, text, jsonb, jsonb, text
) to service_role;

commit;
