-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations_legacy_20260812-161308\20260805_profile_management_phase_3.sql
-- SHA256: 8389d912e83543314d91c645ec17c9c59cb8fc5625b98ccaa34a7333fabd416f
-- PHASE: 07_trust_security
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
begin;

-- Phase 3 : une connexion peut créer jusqu'à cinq profils KLYX.
-- La fonction crée aussi le premier service lorsqu'il s'agit d'un prestataire.
create or replace function public.klyx_create_profile(
  p_first_name text,
  p_last_name text,
  p_city text,
  p_account_type text,
  p_service_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_id uuid := auth.uid();
  profile_id uuid := gen_random_uuid();
  normalized_first_name text := nullif(trim(p_first_name), '');
  normalized_last_name text := nullif(trim(p_last_name), '');
  normalized_city text := nullif(trim(p_city), '');
  service_name text;
  service_slug text;
  user_service_id uuid;
begin
  if owner_id is null then
    raise exception 'KLYX_NOT_AUTHENTICATED';
  end if;

  if normalized_first_name is null or length(normalized_first_name) > 60 then
    raise exception 'KLYX_INVALID_FIRST_NAME';
  end if;

  if normalized_last_name is null or length(normalized_last_name) > 60 then
    raise exception 'KLYX_INVALID_LAST_NAME';
  end if;

  if normalized_city is null or length(normalized_city) > 100 then
    raise exception 'KLYX_INVALID_CITY';
  end if;

  if p_account_type not in ('client', 'provider') then
    raise exception 'KLYX_INVALID_ACCOUNT_TYPE';
  end if;

  if (
    select count(*)
    from public.profiles profile
    where profile.owner_user_id = owner_id
  ) >= 5 then
    raise exception 'KLYX_PROFILE_LIMIT_REACHED';
  end if;

  if p_account_type = 'provider' then
    if p_service_id is null then
      raise exception 'KLYX_SERVICE_REQUIRED';
    end if;

    select service.name, service.slug
    into service_name, service_slug
    from public.services service
    where service.id = p_service_id;

    if service_name is null then
      raise exception 'KLYX_SERVICE_NOT_FOUND';
    end if;
  end if;

  insert into public.profiles (
    id,
    owner_user_id,
    first_name,
    last_name,
    full_name,
    city,
    account_type,
    current_mode,
    role
  )
  values (
    profile_id,
    owner_id,
    normalized_first_name,
    normalized_last_name,
    normalized_first_name || ' ' || normalized_last_name,
    normalized_city,
    p_account_type,
    p_account_type,
    case when p_account_type = 'provider' then 'babysitter' else 'client' end
  );

  if p_account_type = 'provider' then
    insert into public.user_services (
      user_id,
      service_id,
      active
    )
    values (
      profile_id,
      p_service_id,
      true
    )
    returning id into user_service_id;

    insert into public.service_profiles (
      user_service_id,
      title,
      city,
      available,
      rating,
      review_count,
      permit,
      smoker
    )
    values (
      user_service_id,
      case
        when service_slug = 'babysitting' then 'Baby-sitter'
        else service_name
      end,
      normalized_city,
      true,
      0,
      0,
      false,
      false
    );
  end if;

  return profile_id;
end;
$$;

revoke all on function public.klyx_create_profile(text, text, text, text, uuid)
from public;

grant execute on function public.klyx_create_profile(text, text, text, text, uuid)
to authenticated;

-- La suppression retire seulement un profil appartenant à la connexion.
-- Si des réservations ou d'autres données historiques le référencent,
-- PostgreSQL annule toute l'opération afin de protéger cet historique.
create or replace function public.klyx_delete_profile(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null then
    raise exception 'KLYX_NOT_AUTHENTICATED';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_profile_id
      and profile.owner_user_id = owner_id
  ) then
    raise exception 'KLYX_PROFILE_NOT_OWNED';
  end if;

  if (
    select count(*)
    from public.profiles profile
    where profile.owner_user_id = owner_id
  ) <= 1 then
    raise exception 'KLYX_LAST_PROFILE';
  end if;

  delete from public.availability_slots slot
  where slot.user_service_id in (
    select user_service.id
    from public.user_services user_service
    where user_service.user_id = p_profile_id
  );

  delete from public.service_profiles service_profile
  where service_profile.user_service_id in (
    select user_service.id
    from public.user_services user_service
    where user_service.user_id = p_profile_id
  );

  delete from public.user_services user_service
  where user_service.user_id = p_profile_id;

  delete from public.profiles profile
  where profile.id = p_profile_id
    and profile.owner_user_id = owner_id;
end;
$$;

revoke all on function public.klyx_delete_profile(uuid) from public;
grant execute on function public.klyx_delete_profile(uuid) to authenticated;

commit;
