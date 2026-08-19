-- KLYX_PROVIDER_GALLERY_PRIVILEGES_12B_13B
--
-- Public provider pages need gallery metadata, but Provider Studio already owns
-- every gallery mutation through its authenticated server API + supabaseAdmin.
-- Keep the historical published/owner RLS visibility rule, remove browser
-- writes, and stop exposing the internal storage_path column to browser roles.

begin;

revoke all privileges on table public.provider_gallery
  from public, anon, authenticated;

grant select (
  id,
  profile_id,
  public_url,
  caption,
  position
) on table public.provider_gallery
  to anon, authenticated;

grant all privileges on table public.provider_gallery
  to service_role;

drop policy if exists "klyx_provider_gallery_delete"
  on public.provider_gallery;
drop policy if exists "klyx_provider_gallery_insert"
  on public.provider_gallery;
drop policy if exists "klyx_provider_gallery_update"
  on public.provider_gallery;

-- klyx_provider_gallery_select is deliberately preserved. It already limits
-- anonymous reads to published provider profiles and lets owners inspect their
-- own gallery. Only its underlying SQL privileges are narrowed here.

commit;
