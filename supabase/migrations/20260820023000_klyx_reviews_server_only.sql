-- KLYX_REVIEWS_SERVER_ONLY_12B_13P
-- Simple reviews, grouped reviews, and public provider review rendering are all
-- mediated by KLYX server routes using supabaseAdmin. Raw review rows contain
-- participant and booking identifiers and are not a browser PostgREST surface.

begin;

revoke all privileges on table public.reviews
  from public, anon, authenticated;

grant all privileges on table public.reviews
  to service_role;

-- Direct RLS access is obsolete now that all active review flows are mediated
-- by server-side authorization and public review projection routes.
drop policy if exists "klyx_reviews_select"
  on public.reviews;
drop policy if exists "klyx_reviews_authenticated_select"
  on public.reviews;
drop policy if exists "klyx_reviews_insert"
  on public.reviews;
drop policy if exists "klyx_reviews_update"
  on public.reviews;

commit;
