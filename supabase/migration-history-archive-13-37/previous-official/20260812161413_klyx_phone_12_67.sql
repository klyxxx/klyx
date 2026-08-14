-- KLYX_PHONE_FOUNDATION_12_67

alter table public.profiles
  add column if not exists phone_number text;

alter table public.profiles
  add column if not exists phone_verified_at timestamptz;

alter table public.profiles
  add column if not exists phone_visibility text
  not null default 'transaction_participants';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_phone_visibility_check'
  ) then
    alter table public.profiles
      add constraint profiles_phone_visibility_check
      check (
        phone_visibility in (
          'private',
          'transaction_participants'
        )
      );
  end if;
end
$$;

comment on column public.profiles.phone_number is
  'Numero de telephone KLYX au format international E.164.';

comment on column public.profiles.phone_verified_at is
  'Date de verification OTP du numero de telephone.';

comment on column public.profiles.phone_visibility is
  'Controle la visibilite du numero. Jamais public par defaut.';