-- KLYX_GROUP_PROVIDER_ACCEPT_LIVE_GUARD_13_06

create or replace function
public.klyx_enforce_group_provider_accept_live_13_06()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_row jsonb;
  v_old_row jsonb;
  v_child jsonb;
  v_offer jsonb;

  v_new_status text;
  v_old_status text;

  v_request_id uuid;
  v_provider_profile_id uuid;
  v_user_service_id uuid;
  v_offer_id uuid;

  v_live jsonb;

  v_ok boolean;
  v_full boolean;

  v_coverage_count integer;
  v_slot_count integer;

  v_code text;
begin
  v_new_row :=
    to_jsonb(new);

  v_old_row :=
    to_jsonb(old);

  v_new_status :=
    lower(
      coalesce(
        v_new_row ->> 'status',
        ''
      )
    );

  v_old_status :=
    lower(
      coalesce(
        v_old_row ->> 'status',
        ''
      )
    );

  /*
    KLYX 13.06

    Refus et autres transitions :
    inchanges.

    La revalidation intervient uniquement
    lorsque le prestataire tente de passer
    le groupe a accepted.
  */
  if
    v_new_status not in (
      'accepted',
      'provider_accepted'
    )
  then
    return new;
  end if;

  if
    v_old_status in (
      'accepted',
      'provider_accepted'
    )
  then
    return new;
  end if;

  /*
    ----------------------------------------------------------
    CONTEXTE DIRECT DU BOOKING GROUP
    ----------------------------------------------------------

    to_jsonb permet de rester compatible avec
    les variantes historiques de noms de colonnes.
  */

  v_request_id :=
    nullif(
      coalesce(
        v_new_row ->> 'market_request_id',
        v_new_row ->> 'request_id'
      ),
      ''
    )::uuid;

  v_provider_profile_id :=
    nullif(
      coalesce(
        v_new_row ->> 'provider_profile_id',
        v_new_row ->> 'provider_id'
      ),
      ''
    )::uuid;

  v_user_service_id :=
    nullif(
      coalesce(
        v_new_row ->> 'user_service_id',
        v_new_row ->> 'service_id'
      ),
      ''
    )::uuid;

  v_offer_id :=
    nullif(
      coalesce(
        v_new_row ->> 'market_offer_id',
        v_new_row ->> 'offer_id',
        v_new_row ->> 'selected_offer_id'
      ),
      ''
    )::uuid;

  /*
    ----------------------------------------------------------
    FALLBACK : PREMIER BOOKING ENFANT
    ----------------------------------------------------------
  */

  select
    to_jsonb(b)
  into
    v_child
  from
    public.bookings b
  where
    b.booking_group_id =
      new.id
  order by
    b.id
  limit 1;

  if
    v_child is not null
  then
    if
      v_request_id is null
    then
      v_request_id :=
        nullif(
          coalesce(
            v_child ->> 'market_request_id',
            v_child ->> 'request_id'
          ),
          ''
        )::uuid;
    end if;

    if
      v_provider_profile_id is null
    then
      v_provider_profile_id :=
        nullif(
          coalesce(
            v_child ->> 'provider_id',
            v_child ->> 'babysitter_id',
            v_child ->> 'provider_profile_id'
          ),
          ''
        )::uuid;
    end if;

    if
      v_user_service_id is null
    then
      v_user_service_id :=
        nullif(
          coalesce(
            v_child ->> 'user_service_id',
            v_child ->> 'service_id'
          ),
          ''
        )::uuid;
    end if;

    if
      v_offer_id is null
    then
      v_offer_id :=
        nullif(
          coalesce(
            v_child ->> 'market_offer_id',
            v_child ->> 'offer_id',
            v_child ->> 'selected_offer_id'
          ),
          ''
        )::uuid;
    end if;
  end if;

  /*
    ----------------------------------------------------------
    FALLBACK : OFFRE KLYX
    ----------------------------------------------------------

    12.94/12.95 garantissent deja que
    l'offre multi-slot correspond a un service
    prestataire precis.
  */

  if
    v_offer_id is not null
  then
    select
      to_jsonb(o)
    into
      v_offer
    from
      public.market_service_offers o
    where
      o.id =
        v_offer_id
    limit 1;

  elsif
    v_request_id is not null
    and
    v_provider_profile_id is not null
  then
    select
      to_jsonb(o)
    into
      v_offer
    from
      public.market_service_offers o
    where
      o.request_id =
        v_request_id
      and
      o.provider_profile_id =
        v_provider_profile_id
    limit 1;
  end if;

  if
    v_offer is not null
  then
    if
      v_request_id is null
    then
      v_request_id :=
        nullif(
          v_offer ->> 'request_id',
          ''
        )::uuid;
    end if;

    if
      v_provider_profile_id is null
    then
      v_provider_profile_id :=
        nullif(
          v_offer ->> 'provider_profile_id',
          ''
        )::uuid;
    end if;

    if
      v_user_service_id is null
    then
      v_user_service_id :=
        nullif(
          v_offer ->> 'user_service_id',
          ''
        )::uuid;
    end if;
  end if;

  /*
    Si KLYX ne peut pas prouver exactement
    quel prestataire/service/requete compose
    la mission groupee, il ne valide pas
    silencieusement l'acceptation.
  */

  if
    v_request_id is null
    or
    v_provider_profile_id is null
    or
    v_user_service_id is null
  then
    raise exception
      'KLYX_GROUP_ACCEPT_LIVE_CONTEXT_REQUIRED'
      using
        errcode =
          'P0001';
  end if;

  /*
    ----------------------------------------------------------
    REVALIDATION LIVE 12.96
    ----------------------------------------------------------

    Elle verifie notamment :
    - service actif
    - tous les slots
    - horaires
    - disponibilites
    - conflits accepted/completed
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
      'KLYX_GROUP_ACCEPT_LIVE_COVERAGE_REQUIRED:NO_RESULT'
      using
        errcode =
          'P0001';
  end if;

  /*
    Support des deux formes possibles
    camelCase / snake_case du JSON RPC.
  */

  v_ok :=
    coalesce(
      nullif(
        v_live ->> 'ok',
        ''
      )::boolean,
      false
    );

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

  v_code :=
    coalesce(
      nullif(
        v_live ->> 'code',
        ''
      ),
      'UNKNOWN'
    );

  /*
    N/N obligatoire.

    Exemple :
    2 slots requis
    1 disponible
    => acceptation refusee.
  */

  if
    v_ok is distinct from true
    or
    v_full is distinct from true
    or
    v_slot_count < 2
    or
    v_coverage_count <>
      v_slot_count
  then
    raise exception
      'KLYX_GROUP_ACCEPT_LIVE_COVERAGE_REQUIRED:%',
      v_code
      using
        errcode =
          'P0001';
  end if;

  /*
    Aucune acceptation automatique ici.

    Le trigger ne fait qu'autoriser
    la transition explicitement demandee
    par le prestataire.
  */

  return new;
end;
$$;

drop trigger if exists
klyx_group_provider_accept_live_13_06
on public.booking_groups;

create trigger
klyx_group_provider_accept_live_13_06
before update of status
on public.booking_groups
for each row
execute function
public.klyx_enforce_group_provider_accept_live_13_06();

comment on function
public.klyx_enforce_group_provider_accept_live_13_06()
is
'KLYX 13.06 - revalidation live atomique avant acceptation explicite d une mission groupee par le prestataire.';