-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations_legacy_20260812-161308\20260805_active_profile_phase_2.sql
-- SHA256: 81ec770dabd19a9fc53c55c4c67129838ee86c23731875ebdd32810ac97f75e0
-- PHASE: 07_trust_security
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
begin;

-- Les anciens triggers de création de compte peuvent encore insérer un profil
-- sans owner_user_id. Ce trigger garantit la compatibilité avec les nouveaux
-- comptes tout en gardant un rôle unique et fiable.
create or replace function public.klyx_prepare_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.owner_user_id := coalesce(new.owner_user_id, new.id);
  new.account_type := case
    when new.account_type = 'provider' then 'provider'
    when new.role in ('provider', 'babysitter') then 'provider'
    else 'client'
  end;
  return new;
end;
$$;

drop trigger if exists klyx_prepare_profile_before_insert on public.profiles;
create trigger klyx_prepare_profile_before_insert
before insert on public.profiles
for each row execute function public.klyx_prepare_profile();

alter table public.profiles
  alter column account_type set default 'client';

-- Fonctions utilisées par les politiques RLS. Elles sont SECURITY DEFINER pour
-- éviter les récursions entre profiles, bookings et les tables métier.
create or replace function public.klyx_owns_profile(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = profile_id
      and profile.owner_user_id = auth.uid()
  );
$$;

create or replace function public.klyx_profile_has_type(
  profile_id uuid,
  expected_type text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = profile_id
      and profile.account_type = expected_type
  );
$$;

create or replace function public.klyx_owns_booking(booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.bookings booking
    where booking.id = booking_id
      and (
        public.klyx_owns_profile(booking.parent_id)
        or public.klyx_owns_profile(
          coalesce(booking.provider_id, booking.babysitter_id)
        )
      )
  );
$$;

create or replace function public.klyx_shares_booking_with_profile(
  other_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.bookings booking
    where (
      booking.parent_id = other_profile_id
      or coalesce(booking.provider_id, booking.babysitter_id) = other_profile_id
    )
      and (
        public.klyx_owns_profile(booking.parent_id)
        or public.klyx_owns_profile(
          coalesce(booking.provider_id, booking.babysitter_id)
        )
      )
  );
$$;

create or replace function public.klyx_valid_message_participants(
  booking_id uuid,
  sender_id uuid,
  receiver_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.bookings booking
    where booking.id = booking_id
      and (
        (
          booking.parent_id = sender_id
          and coalesce(booking.provider_id, booking.babysitter_id) = receiver_id
        )
        or (
          booking.parent_id = receiver_id
          and coalesce(booking.provider_id, booking.babysitter_id) = sender_id
        )
      )
  );
$$;

create or replace function public.klyx_can_review(
  booking_id uuid,
  author_id uuid,
  target_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.bookings booking
    where booking.id = booking_id
      and booking.parent_id = author_id
      and coalesce(booking.provider_id, booking.babysitter_id) = target_id
      and booking.status = 'completed'
  );
$$;

create or replace function public.klyx_owns_user_service(user_service_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_services user_service
    where user_service.id = user_service_id
      and public.klyx_owns_profile(user_service.user_id)
  );
$$;

create or replace function public.klyx_owns_project(project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.projects project
    where project.id = project_id
      and public.klyx_owns_profile(project.user_id)
  );
$$;

create or replace function public.klyx_owns_conversation(conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.brain_conversations conversation
    where conversation.id = conversation_id
      and public.klyx_owns_profile(conversation.user_id)
  );
$$;

create or replace function public.klyx_owns_avatar_path(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  folder_id text;
begin
  folder_id := split_part(object_name, '/', 1);

  if folder_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  return public.klyx_owns_profile(folder_id::uuid);
end;
$$;

revoke all on function public.klyx_owns_profile(uuid) from public;
revoke all on function public.klyx_profile_has_type(uuid, text) from public;
revoke all on function public.klyx_owns_booking(uuid) from public;
revoke all on function public.klyx_shares_booking_with_profile(uuid) from public;
revoke all on function public.klyx_valid_message_participants(uuid, uuid, uuid) from public;
revoke all on function public.klyx_can_review(uuid, uuid, uuid) from public;
revoke all on function public.klyx_owns_user_service(uuid) from public;
revoke all on function public.klyx_owns_project(uuid) from public;
revoke all on function public.klyx_owns_conversation(uuid) from public;
revoke all on function public.klyx_owns_avatar_path(text) from public;

grant execute on function public.klyx_owns_profile(uuid) to anon, authenticated;
grant execute on function public.klyx_profile_has_type(uuid, text) to anon, authenticated;
grant execute on function public.klyx_owns_booking(uuid) to authenticated;
grant execute on function public.klyx_shares_booking_with_profile(uuid) to anon, authenticated;
grant execute on function public.klyx_valid_message_participants(uuid, uuid, uuid) to authenticated;
grant execute on function public.klyx_can_review(uuid, uuid, uuid) to authenticated;
grant execute on function public.klyx_owns_user_service(uuid) to authenticated;
grant execute on function public.klyx_owns_project(uuid) to authenticated;
grant execute on function public.klyx_owns_conversation(uuid) to authenticated;
grant execute on function public.klyx_owns_avatar_path(text) to authenticated;

-- Outils temporaires pour remplacer proprement les anciennes politiques.
create or replace function public.klyx_reset_policies(table_name text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  policy_row record;
begin
  if to_regclass(format('public.%I', table_name)) is null then
    return;
  end if;

  execute format('alter table public.%I enable row level security', table_name);

  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = table_name
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      policy_row.policyname,
      table_name
    );
  end loop;
end;
$$;

create or replace function public.klyx_add_policy(
  table_name text,
  policy_name text,
  command_name text,
  role_list text,
  using_expression text default null,
  check_expression text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  statement text;
begin
  if to_regclass(format('public.%I', table_name)) is null then
    return;
  end if;

  statement := format(
    'create policy %I on public.%I for %s to %s',
    policy_name,
    table_name,
    command_name,
    role_list
  );

  if using_expression is not null then
    statement := statement || format(' using (%s)', using_expression);
  end if;

  if check_expression is not null then
    statement := statement || format(' with check (%s)', check_expression);
  end if;

  execute statement;
end;
$$;

select public.klyx_reset_policies(table_name)
from unnest(array[
  'profiles',
  'services',
  'user_services',
  'service_profiles',
  'availability_slots',
  'bookings',
  'booking_tracking_events',
  'messages',
  'favorites',
  'reviews',
  'notifications',
  'user_notifications',
  'user_preferences',
  'user_memory_events',
  'service_requests',
  'brain_conversations',
  'brain_messages',
  'projects',
  'project_services',
  'stores'
]) as managed_tables(table_name);

select public.klyx_add_policy(
  'profiles',
  'klyx_profiles_select',
  'select',
  'anon, authenticated',
  'account_type = ''provider'' or owner_user_id = auth.uid() or public.klyx_shares_booking_with_profile(id)'
);
select public.klyx_add_policy(
  'profiles',
  'klyx_profiles_insert',
  'insert',
  'authenticated',
  null,
  'owner_user_id = auth.uid()'
);
select public.klyx_add_policy(
  'profiles',
  'klyx_profiles_update',
  'update',
  'authenticated',
  'owner_user_id = auth.uid()',
  'owner_user_id = auth.uid()'
);
select public.klyx_add_policy(
  'profiles',
  'klyx_profiles_delete',
  'delete',
  'authenticated',
  'owner_user_id = auth.uid()'
);

select public.klyx_add_policy(
  'services',
  'klyx_services_select',
  'select',
  'anon, authenticated',
  'true'
);

select public.klyx_add_policy(
  'user_services',
  'klyx_user_services_select',
  'select',
  'anon, authenticated',
  'active = true or public.klyx_owns_profile(user_id)'
);
select public.klyx_add_policy(
  'user_services',
  'klyx_user_services_insert',
  'insert',
  'authenticated',
  null,
  'public.klyx_owns_profile(user_id) and public.klyx_profile_has_type(user_id, ''provider'')'
);
select public.klyx_add_policy(
  'user_services',
  'klyx_user_services_update',
  'update',
  'authenticated',
  'public.klyx_owns_profile(user_id)',
  'public.klyx_owns_profile(user_id)'
);
select public.klyx_add_policy(
  'user_services',
  'klyx_user_services_delete',
  'delete',
  'authenticated',
  'public.klyx_owns_profile(user_id)'
);

select public.klyx_add_policy(
  'service_profiles',
  'klyx_service_profiles_select',
  'select',
  'anon, authenticated',
  'exists (select 1 from public.user_services us where us.id = user_service_id and (us.active = true or public.klyx_owns_profile(us.user_id)))'
);
select public.klyx_add_policy(
  'service_profiles',
  'klyx_service_profiles_insert',
  'insert',
  'authenticated',
  null,
  'public.klyx_owns_user_service(user_service_id)'
);
select public.klyx_add_policy(
  'service_profiles',
  'klyx_service_profiles_update',
  'update',
  'authenticated',
  'public.klyx_owns_user_service(user_service_id)',
  'public.klyx_owns_user_service(user_service_id)'
);
select public.klyx_add_policy(
  'service_profiles',
  'klyx_service_profiles_delete',
  'delete',
  'authenticated',
  'public.klyx_owns_user_service(user_service_id)'
);

select public.klyx_add_policy(
  'availability_slots',
  'klyx_availability_select',
  'select',
  'anon, authenticated',
  'true'
);
select public.klyx_add_policy(
  'availability_slots',
  'klyx_availability_insert',
  'insert',
  'authenticated',
  null,
  'public.klyx_owns_user_service(user_service_id)'
);
select public.klyx_add_policy(
  'availability_slots',
  'klyx_availability_update',
  'update',
  'authenticated',
  'public.klyx_owns_user_service(user_service_id)',
  'public.klyx_owns_user_service(user_service_id)'
);
select public.klyx_add_policy(
  'availability_slots',
  'klyx_availability_delete',
  'delete',
  'authenticated',
  'public.klyx_owns_user_service(user_service_id)'
);

select public.klyx_add_policy(
  'bookings',
  'klyx_bookings_select',
  'select',
  'authenticated',
  'public.klyx_owns_profile(parent_id) or public.klyx_owns_profile(coalesce(provider_id, babysitter_id))'
);
select public.klyx_add_policy(
  'bookings',
  'klyx_bookings_insert',
  'insert',
  'authenticated',
  null,
  'public.klyx_owns_profile(parent_id) and public.klyx_profile_has_type(parent_id, ''client'') and public.klyx_profile_has_type(coalesce(provider_id, babysitter_id), ''provider'') and parent_id <> coalesce(provider_id, babysitter_id)'
);

select public.klyx_add_policy(
  'booking_tracking_events',
  'klyx_tracking_select',
  'select',
  'authenticated',
  'public.klyx_owns_booking(booking_id)'
);

select public.klyx_add_policy(
  'messages',
  'klyx_messages_select',
  'select',
  'authenticated',
  'public.klyx_owns_booking(booking_id)'
);
select public.klyx_add_policy(
  'messages',
  'klyx_messages_insert',
  'insert',
  'authenticated',
  null,
  'public.klyx_owns_profile(sender_id) and public.klyx_valid_message_participants(booking_id, sender_id, receiver_id)'
);
select public.klyx_add_policy(
  'messages',
  'klyx_messages_update',
  'update',
  'authenticated',
  'public.klyx_owns_profile(receiver_id)',
  'public.klyx_owns_profile(receiver_id)'
);

select public.klyx_add_policy(
  'favorites',
  'klyx_favorites_all',
  'all',
  'authenticated',
  'public.klyx_owns_profile(user_id)',
  'public.klyx_owns_profile(user_id) and public.klyx_profile_has_type(user_id, ''client'')'
);

select public.klyx_add_policy(
  'reviews',
  'klyx_reviews_select',
  'select',
  'anon, authenticated',
  'true'
);
select public.klyx_add_policy(
  'reviews',
  'klyx_reviews_insert',
  'insert',
  'authenticated',
  null,
  'public.klyx_owns_profile(author_id) and public.klyx_can_review(booking_id, author_id, target_id)'
);
select public.klyx_add_policy(
  'reviews',
  'klyx_reviews_update',
  'update',
  'authenticated',
  'public.klyx_owns_profile(author_id)',
  'public.klyx_owns_profile(author_id) and public.klyx_can_review(booking_id, author_id, target_id)'
);

select public.klyx_add_policy(
  'notifications',
  'klyx_notifications_all',
  'all',
  'authenticated',
  'public.klyx_owns_profile(user_id)',
  'public.klyx_owns_profile(user_id)'
);
select public.klyx_add_policy(
  'user_notifications',
  'klyx_user_notifications_all',
  'all',
  'authenticated',
  'public.klyx_owns_profile(user_id)',
  'public.klyx_owns_profile(user_id)'
);
select public.klyx_add_policy(
  'user_preferences',
  'klyx_user_preferences_all',
  'all',
  'authenticated',
  'public.klyx_owns_profile(user_id)',
  'public.klyx_owns_profile(user_id)'
);
select public.klyx_add_policy(
  'user_memory_events',
  'klyx_memory_events_all',
  'all',
  'authenticated',
  'public.klyx_owns_profile(user_id)',
  'public.klyx_owns_profile(user_id)'
);
select public.klyx_add_policy(
  'service_requests',
  'klyx_service_requests_all',
  'all',
  'authenticated',
  'public.klyx_owns_profile(user_id)',
  'public.klyx_owns_profile(user_id)'
);

select public.klyx_add_policy(
  'brain_conversations',
  'klyx_brain_conversations_all',
  'all',
  'authenticated',
  'public.klyx_owns_profile(user_id)',
  'public.klyx_owns_profile(user_id)'
);
select public.klyx_add_policy(
  'brain_messages',
  'klyx_brain_messages_all',
  'all',
  'authenticated',
  'public.klyx_owns_conversation(conversation_id)',
  'public.klyx_owns_conversation(conversation_id)'
);

select public.klyx_add_policy(
  'projects',
  'klyx_projects_all',
  'all',
  'authenticated',
  'public.klyx_owns_profile(user_id)',
  'public.klyx_owns_profile(user_id)'
);
select public.klyx_add_policy(
  'project_services',
  'klyx_project_services_all',
  'all',
  'authenticated',
  'public.klyx_owns_project(project_id)',
  'public.klyx_owns_project(project_id)'
);
select public.klyx_add_policy(
  'stores',
  'klyx_stores_all',
  'all',
  'authenticated',
  'public.klyx_owns_profile(owner_id)',
  'public.klyx_owns_profile(owner_id)'
);

drop function public.klyx_add_policy(text, text, text, text, text, text);
drop function public.klyx_reset_policies(text);

-- Supabase active déjà RLS sur storage.objects. Il ne faut pas exécuter
-- ALTER TABLE ici, car cette table système appartient à Supabase Storage.
-- Les avatars restent publics, mais seules les connexions propriétaires du
-- profil indiqué dans le premier dossier peuvent écrire ou supprimer l'image.

drop policy if exists "klyx_avatars_select" on storage.objects;
create policy "klyx_avatars_select"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'avatars');

drop policy if exists "klyx_avatars_insert" on storage.objects;
create policy "klyx_avatars_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and public.klyx_owns_avatar_path(name)
);

drop policy if exists "klyx_avatars_update" on storage.objects;
create policy "klyx_avatars_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and public.klyx_owns_avatar_path(name)
)
with check (
  bucket_id = 'avatars'
  and public.klyx_owns_avatar_path(name)
);

drop policy if exists "klyx_avatars_delete" on storage.objects;
create policy "klyx_avatars_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and public.klyx_owns_avatar_path(name)
);

commit;
