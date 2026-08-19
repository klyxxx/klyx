-- ============================================================
-- KLYX 12B.12X FAVORITE TABLE PRIVILEGE HARDENING
--
-- favorites is intentionally still browser-accessible because the current
-- FavoriteButton and favorites page use authenticated Supabase reads/writes.
-- Keep that UX while removing anon access, UPDATE and every unrelated table
-- privilege. New favorites may set only the owner and service-profile columns.
--
-- KLYX_FAVORITE_TABLE_PRIVILEGES_12B_12X
-- ============================================================

begin;

revoke all privileges on table public.favorites
  from public, anon, authenticated;

-- Replace the historical ALL-command policy with explicit least-privilege
-- policies. This makes a future accidental UPDATE grant fail closed at RLS.
drop policy if exists "klyx_favorites_all"
  on public.favorites;

create policy "klyx_favorites_select"
  on public.favorites
  for select
  to authenticated
  using (
    public.klyx_owns_profile(user_id)
  );

create policy "klyx_favorites_insert"
  on public.favorites
  for insert
  to authenticated
  with check (
    public.klyx_owns_profile(user_id)
    and public.klyx_profile_has_type(user_id, 'client'::text)
  );

create policy "klyx_favorites_delete"
  on public.favorites
  for delete
  to authenticated
  using (
    public.klyx_owns_profile(user_id)
  );

grant select on table public.favorites
  to authenticated;
grant insert (user_id, service_profile_id) on table public.favorites
  to authenticated;
grant delete on table public.favorites
  to authenticated;

grant all privileges on table public.favorites
  to service_role;

commit;
