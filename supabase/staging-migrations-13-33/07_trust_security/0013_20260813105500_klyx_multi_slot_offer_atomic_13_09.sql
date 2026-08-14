-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations\20260813105500_klyx_multi_slot_offer_atomic_13_09.sql
-- SHA256: 7b745c3d6a18bb94e85eff00e838fe047680c5aebe545637c2d721d36530024f
-- PHASE: 07_trust_security
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
-- KLYX_MULTI_SLOT_OFFER_ATOMIC_GUARD_13_09

create or replace function
public.klyx_enforce_multi_slot_offer_live_13_09()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer jsonb;
  v_request jsonb;

  v_request_id uuid;
  v_provider_profile_id uuid;
  v_user_service_id uuid;

  v_offer_status text;
  v_request_mode text;
  v_request_status text;

  v_expected_slots integer;

  v_live jsonb;

  v_ok boolean;
  v_full boolean;

  v_coverage_count integer;
  v_slot_count integer;

  v_code text;
begin
  v_offer :=
    to_jsonb(new);

  /*
    ----------------------------------------------------------
    CONTEXTE OFFRE
    ----------------------------------------------------------
  */

  begin
    v_request_id :=
      nullif(
        coalesce(
          v_offer ->> 'request_id',
          v_offer ->> 'market_request_id'
        ),
        ''
      )::uuid;
  exception
    when others then
      v_request_id := null;
  end;

  begin
    v_provider_profile_id :=
      nullif(
        coalesce(
          v_offer ->> 'provider_profile_id',
          v_offer ->> 'provider_id'
        ),
        ''
      )::uuid;
  exception
    when others then
      v_provider_profile_id := null;
  end;

  begin
    v_user_service_id :=
      nullif(
        coalesce(
          v_offer ->> 'user_service_id',
          v_offer ->> 'service_id'
        ),
        ''
      )::uuid;
  exception
    when others then
      v_user_service_id := null;
  end;

  v_offer_status :=
    lower(
      coalesce(
        v_offer ->> 'status',
        ''
      )
    );

  /*
    Les transitions terminales ne constituent
    pas un nouvel envoi commercial.
  */
  if
    v_offer_status in (
      'accepted',
      'rejected',
      'cancelled',
      'canceled',
      'withdrawn',
      'expired'
    )
  then
    return new;
  end if;

  /*
    Laisse les contraintes historiques traiter
    un request_id inexistant ou mal forme.
  */
  if
    v_request_id is null
  then
    return new;
  end if;

  /*
    ----------------------------------------------------------
    MARKET REQUEST
    ----------------------------------------------------------

    select to_jsonb evite de figer inutilement
    les noms historiques du schema.
  */

  select
    to_jsonb(r)
  into
    v_request
  from
    public.market_service_requests r
  where
    r.id =
      v_request_id
  limit 1;

  if
    v_request is null
  then
    return new;
  end if;

  v_request_mode :=
    lower(
      coalesce(
        v_request ->> 'request_mode',
        'single'
      )
    );

  /*
    Mission simple :
    comportement historique inchange.
  */
  if
    v_request_mode <>
      'multi_slot'
  then
    return new;
  end if;

  v_request_status :=
    lower(
      coalesce(
        v_request ->> 'status',
        ''
      )
    );

  begin
    v_expected_slots :=
      coalesce(
        nullif(
          v_request ->> 'slot_count',
          ''
        )::integer,
        0
      );
  exception
    when others then
      v_expected_slots := 0;
  end;

  /*
    Une vraie demande multi-slot doit avoir
    au moins deux creneaux.
  */
  if
    v_expected_slots <
      2
  then
    raise exception
      'KLYX_MULTI_SLOT_OFFER_ATOMIC_INVALID_SLOT_COUNT'
      using
        errcode =
          'P0001';
  end if;

  /*
    Aucune nouvelle offre sur une demande
    deja fermee ou finalisee.
  */
  if
    v_request_status <>
      'open'
  then
    raise exception
      'KLYX_MULTI_SLOT_OFFER_ATOMIC_REQUEST_NOT_OPEN'
      using
        errcode =
          'P0001';
  end if;

  /*
    Pour une offre multi-slot, le contexte
    prestataire/service exact est obligatoire.
  */
  if
    v_provider_profile_id is null
    or
    v_user_service_id is null
  then
    raise exception
      'KLYX_MULTI_SLOT_OFFER_ATOMIC_CONTEXT_REQUIRED'
      using
        errcode =
          'P0001';
  end if;

  /*
    ----------------------------------------------------------
    REVALIDATION LIVE
    ----------------------------------------------------------

    Source de verite :
    RPC atomique introduite en 12.96.
  */

  select
    public.klyx_group_live_coverage_check(
      v_request_id,
      v_provider_profile_id,
      v_user_service_id
    )
  into
    v_live;

  if
    v_live is null
  then
    raise exception
      'KLYX_MULTI_SLOT_OFFER_ATOMIC_COVERAGE_REQUIRED:NO_RESULT'
      using
        errcode =
          'P0001';
  end if;

  /*
    Compatible camelCase + snake_case.
  */

  begin
    v_ok :=
      coalesce(
        nullif(
          v_live ->> 'ok',
          ''
        )::boolean,
        false
      );
  exception
    when others then
      v_ok := false;
  end;

  begin
    v_full :=
      coalesce(
        nullif(
          v_live ->> 'fullCoverage',
          ''
        )::boolean,
        nullif(
          v_live ->> 'full_coverage',
          ''
        )::boolean,
        false
      );
  exception
    when others then
      v_full := false;
  end;

  begin
    v_coverage_count :=
      coalesce(
        nullif(
          v_live ->> 'coverageCount',
          ''
        )::integer,
        nullif(
          v_live ->> 'coverage_count',
          ''
        )::integer,
        0
      );
  exception
    when others then
      v_coverage_count := 0;
  end;

  begin
    v_slot_count :=
      coalesce(
        nullif(
          v_live ->> 'slotCount',
          ''
        )::integer,
        nullif(
          v_live ->> 'slot_count',
          ''
        )::integer,
        0
      );
  exception
    when others then
      v_slot_count := 0;
  end;

  v_code :=
    coalesce(
      nullif(
        v_live ->> 'code',
        ''
      ),
      'UNKNOWN'
    );

  /*
    ----------------------------------------------------------
    N/N STRICT
    ----------------------------------------------------------

    Entre le controle API 12.95 et cet INSERT,
    un conflit peut apparaitre.

    Le trigger ferme cette fenetre.
  */

  if
    v_ok is distinct from true
    or
    v_full is distinct from true
    or
    v_slot_count <>
      v_expected_slots
    or
    v_coverage_count <>
      v_expected_slots
  then
    raise exception
      'KLYX_MULTI_SLOT_OFFER_ATOMIC_COVERAGE_REQUIRED:%',
      v_code
      using
        errcode =
          'P0001';
  end if;

  /*
    IMPORTANT :

    le trigger ne cree aucune offre.
    Il autorise seulement l'INSERT/UPDATE
    deja explicitement demande par le
    prestataire.
  */

  return new;
end;
$$;

drop trigger if exists
klyx_multi_slot_offer_atomic_13_09
on public.market_service_offers;

create trigger
klyx_multi_slot_offer_atomic_13_09
before insert or update
on public.market_service_offers
for each row
execute function
public.klyx_enforce_multi_slot_offer_live_13_09();

comment on function
public.klyx_enforce_multi_slot_offer_live_13_09()
is
'KLYX 13.09 - garde atomique N/N avant envoi ou modification active d une offre multi-creneaux.';