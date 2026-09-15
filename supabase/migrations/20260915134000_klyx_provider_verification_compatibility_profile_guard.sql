begin;

-- KLYX_PROVIDER_VERIFICATION_COMPATIBILITY_PROFILE_GUARD_20260915
--
-- The canonical account capability remains the authorization authority.
-- The historical profiles.id path segment is only a compatibility storage key,
-- so additionally require that the target profile is actually provider-capable
-- through provider data, never through profiles.account_type.

create or replace function public.klyx_owns_provider_verification_path(
  p_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_folders text[];
  v_profile_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  v_folders := storage.foldername(p_name);

  if array_length(v_folders, 1) <> 2 then
    return false;
  end if;

  if v_folders[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  v_profile_id := v_folders[1]::uuid;

  return
    public.klyx_owns_profile(v_profile_id)
    and public.klyx_profile_account_has_capability(
      v_profile_id,
      'offer_services'
    )
    and (
      exists (
        select 1
        from public.provider_profiles as provider_profile
        where provider_profile.profile_id = v_profile_id
      )
      or exists (
        select 1
        from public.user_services as user_service
        where user_service.user_id = v_profile_id
          and user_service.provider_enabled = true
      )
    );
exception
  when invalid_text_representation then
    return false;
end;
$$;

alter function public.klyx_owns_provider_verification_path(text)
  owner to postgres;

revoke all on function public.klyx_owns_provider_verification_path(text)
  from public, anon, authenticated;
grant execute on function public.klyx_owns_provider_verification_path(text)
  to authenticated, service_role;

comment on function public.klyx_owns_provider_verification_path(text) is
  'Storage RLS adapter: require owned legacy profile folder, canonical offer_services capability, and provider compatibility data without using profiles.account_type as authority.';

commit;
