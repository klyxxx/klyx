-- KLYX_GROUP_PROVIDER_ACCEPT_LIVE_GUARD_13_06

create or replace function
public.klyx_enforce_group_provider_accept_live_13_06()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new jsonb;
  v_old jsonb;
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
  v_full_coverage boolean;

  v_coverage_count integer;
  v_slot_count integer;

  v_code text;
begin
  v_new :=
    to_jsonb(new);

  v_old :=
    to_jsonb(old);

  v_new_status :=
    lower(
      coalesce(
        v_new ->> 'status',
        ''
      )
    );

  v_old_status :=
    lower(
      coalesce(
        v_old ->> 'status',
        ''
      )
    );

  /*
    KLYX 13.06

    Ne concerne que le passage explicite
    du groupe vers un etat accepte.
  */
  if
    v_new_status not in (
      'accepted',
      'provider_accepted'
    )
  then
    return new;
  end if;

  /*
    Pas de revalidation inutile si le groupe
    etait deja accepte.
  */
  if
    v_old_status in (
      'accepted',
      'provider_accepted'
    )
  then
    return new;
  end if;

  /*
    ==========================================================
    CONTEXTE DIRECT DU BOOKING GROUP
    ==========================================================

    to_jsonb permet de rester compatible
    avec les variantes historiques de colonnes.
  */

  begin
    v_request_id :=
      nullif(
        coalesce(
          v_new ->> 'market_request_id',
          v_new ->> 'request_id'
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
          v_new ->> 'provider_profile_id',
          v_new ->> 'provider_id'
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
          v_new ->> 'user_service_id',
          v_new ->> 'service_id'
        ),
        ''
      )::uuid;
  exception
    when others then
      v_user_service_id := null;
  end;

  begin
    v_offer_id :=
      nullif(
        coalesce(
          v_new ->> 'market_offer_id',
          v_new ->> 'offer_id',
          v_new ->> 'selected_offer_id'
        ),
        ''
      )::uuid;
  exception
    when others then
      v_offer_id := null;
  end;

  /*
    ==========================================================
    FALLBACK : BOOKING ENFANT
    ==========================================================
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
    b.group_position nulls last,
    b.id
  limit 1;

  if
    v_child is not null
  then
    if
      v_request_id is null
    then
      begin
        v_request_id :=
          nullif(
            coalesce(
              v_child ->> 'market_request_id',
              v_child ->> 'request_id'
            ),
            ''
          )::uuid;
      exception
        when others then
          v_request_id := null;
      end;
    end if;

    if
      v_provider_profile_id is null
    then
      begin
        v_provider_profile_id :=
          nullif(
            coalesce(
              v_child ->> 'provider_id',
              v_child ->> 'babysitter_id',
              v_child ->> 'provider_profile_id'
            ),
            ''
          )::uuid;
      exception
        when others then
          v_provider_profile_id := null;
      end;
    end if;

    if
      v_user_service_id is null
    then
      begin
        v_user_service_id :=
          nullif(
            coalesce(
              v_child ->> 'user_service_id',
              v_child ->> 'service_id'
            ),
            ''
          )::uuid;
      exception
        when others then
          v_user_service_id := null;
      end;
    end if;

    if
      v_offer_id is null
    then
      begin
        v_offer_id :=
          nullif(
            coalesce(
              v_child ->> 'market_offer_id',
              v_child ->> 'offer_id',
              v_child ->> 'selected_offer_id'
            ),
            ''
          )::uuid;
      exception
        when others then
          v_offer_id := null;
      end;
    end if;
  end if;

  /*
    ==========================================================
    FALLBACK : OFFRE KLYX
    ==========================================================
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
    order by
      o.created_at desc
    limit 1;
  end if;

  if
    v_offer is not null
  then
    if
      v_request_id is null
    then
      begin
        v_request_id :=
          nullif(
            v_offer ->> 'request_id',
            ''
          )::uuid;
      exception
        when others then
          v_request_id := null;
      end;
    end if;

    if
      v_provider_profile_id is null
    then
      begin
        v_provider_profile_id :=
          nullif(
            v_offer ->> 'provider_profile_id',
            ''
          )::uuid;
      exception
        when others then
          v_provider_profile_id := null;
      end;
    end if;

    if
      v_user_service_id is null
    then
      begin
        v_user_service_id :=
          nullif(
            v_offer ->> 'user_service_id',
            ''
          )::uuid;
      exception
        when others then
          v_user_service_id := null;
      end;
    end if;
  end if;

  /*
    KLYX doit pouvoir PROUVER le contexte exact.

    Sinon aucune acceptation silencieuse.
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
    ==========================================================
    REVALIDATION ATOMIQUE 12.96
    ==========================================================

    Verifie notamment :
    - service actif
    - nombre de slots
    - disponibilites
    - conflits booking
    - couverture N/N
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
    Support camelCase + snake_case.
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
    v_full_coverage :=
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
      v_full_coverage := false;
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
    Exactement N/N requis.
  */

  if
    v_ok is distinct from true
    or
    v_full_coverage is distinct from true
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
    Le trigger n'accepte RIEN lui-meme.

    Il autorise seulement la transition
    explicitement demandee.
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
'KLYX 13.06 - revalidation live N/N avant acceptation explicite d une mission groupee.';