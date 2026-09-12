-- ============================================================
-- KLYX TRUST MISSION ENFORCEMENT
--
-- Opt-in fail-closed gate for concrete bookings. This lets KLYX migrate one
-- category/jurisdiction at a time without pretending that every historical
-- booking already has a validated legal/safety policy.
--
-- When enforcement_mode = 'enforce', no application route, legacy RPC or
-- direct service-role booking update may transition the booking to `accepted`
-- unless a current explainable eligibility decision permits it.
-- ============================================================

begin;

create table if not exists public.trust_mission_contexts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  category_key text not null,
  jurisdiction_code text not null,
  policy_id uuid not null references public.trust_category_policies(id) on delete restrict,
  enforcement_mode text not null default 'observe',
  context_source text not null default 'policy_engine',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trust_mission_contexts_booking_key unique (booking_id),
  constraint trust_mission_contexts_category_length_check
    check (char_length(trim(category_key)) between 1 and 120),
  constraint trust_mission_contexts_jurisdiction_length_check
    check (char_length(trim(jurisdiction_code)) between 2 and 32),
  constraint trust_mission_contexts_enforcement_mode_check
    check (enforcement_mode in ('observe', 'enforce')),
  constraint trust_mission_contexts_source_check
    check (context_source in ('system', 'policy_engine', 'human'))
);

comment on table public.trust_mission_contexts is
  'Concrete booking-to-policy binding. Only rows explicitly switched to enforce are fail-closed; this supports controlled category/jurisdiction rollout.';
comment on column public.trust_mission_contexts.enforcement_mode is
  'observe records/evaluates without blocking legacy flows; enforce requires a current permitted eligibility decision before booking acceptance.';

create index if not exists trust_mission_contexts_policy_idx
  on public.trust_mission_contexts (policy_id, enforcement_mode);

alter table public.trust_mission_contexts enable row level security;
revoke all privileges on table public.trust_mission_contexts
  from public, anon, authenticated;
grant all privileges on table public.trust_mission_contexts
  to service_role;

drop policy if exists klyx_server_only_deny_all
  on public.trust_mission_contexts;
create policy klyx_server_only_deny_all
  on public.trust_mission_contexts
  for all
  to anon, authenticated
  using (false)
  with check (false);

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
  permitted_decision_id uuid;
begin
  -- This trigger is deliberately narrow: only the transition into accepted is
  -- guarded. Rejection/cancellation and historical rows are not reinterpreted.
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

  select decision.id
  into permitted_decision_id
  from public.trust_eligibility_decisions as decision
  where decision.account_id = performer_account_id
    and decision.policy_id = mission_context.policy_id
    and decision.target_type = 'booking'
    and decision.target_ref = new.id::text
    and decision.category_key = mission_context.category_key
    and decision.jurisdiction_code = mission_context.jurisdiction_code
    and decision.decision in ('eligible', 'eligible_with_conditions')
    and (
      decision.human_review_required = false
      or decision.review_status = 'approved'
    )
    and (
      decision.expires_at is null
      or decision.expires_at > now()
    )
  order by decision.created_at desc
  limit 1;

  if permitted_decision_id is null then
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

drop trigger if exists klyx_bookings_enforce_trust_eligibility
  on public.bookings;
create trigger klyx_bookings_enforce_trust_eligibility
before update of status
on public.bookings
for each row
execute function public.klyx_enforce_booking_trust_eligibility();

commit;
