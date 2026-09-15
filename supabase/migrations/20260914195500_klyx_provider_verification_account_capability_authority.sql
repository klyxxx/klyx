begin;

-- KLYX_PROVIDER_VERIFICATION_ACCOUNT_CAPABILITY_AUTHORITY_20260914
--
-- Provider verification Storage paths remain keyed by historical profiles.id
-- for compatibility, but provider authorization must follow the canonical
-- accounts.id capability authority introduced by account_actor_capabilities.
-- This migration is additive: it replaces only the existing authorization
-- helper implementation. No Storage object, legacy profile, booking, payment,
-- Stripe identifier, table or column is removed or rewritten.

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
  'Storage RLS adapter: the authenticated user must own the historical profile folder and its canonical account must currently have offer_services enabled.';

commit;
