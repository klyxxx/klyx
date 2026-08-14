-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations_legacy_20260812-161308\20260804_multi_profiles_phase_1.sql
-- SHA256: 4eb5a016501c172738fe9eb096cf1df7f68bf208dce70e3ce5fd2c6bee68b8e3
-- PHASE: 07_trust_security
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
begin;

alter table public.profiles
  add column if not exists owner_user_id uuid;

update public.profiles
set owner_user_id = id
where owner_user_id is null;

alter table public.profiles
  alter column owner_user_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_owner_user_id_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_owner_user_id_fkey
      foreign key (owner_user_id)
      references auth.users(id)
      on delete cascade;
  end if;
end
$$;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.profiles'::regclass
      and c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and c.conkey = array[
        (select attnum
         from pg_attribute
         where attrelid = 'public.profiles'::regclass
           and attname = 'id')
      ]::smallint[]
  loop
    execute format(
      'alter table public.profiles drop constraint %I',
      constraint_name
    );
  end loop;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_account_type_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_account_type_check
      check (account_type in ('client', 'provider'));
  end if;
end
$$;

create index if not exists profiles_owner_user_id_idx
  on public.profiles(owner_user_id);

alter table public.profiles enable row level security;

drop policy if exists "Owners can read their profiles" on public.profiles;
create policy "Owners can read their profiles"
  on public.profiles
  for select
  to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "Owners can update their profiles" on public.profiles;
create policy "Owners can update their profiles"
  on public.profiles
  for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "Users can create their own profiles" on public.profiles;
create policy "Users can create their own profiles"
  on public.profiles
  for insert
  to authenticated
  with check (owner_user_id = auth.uid());

commit;
