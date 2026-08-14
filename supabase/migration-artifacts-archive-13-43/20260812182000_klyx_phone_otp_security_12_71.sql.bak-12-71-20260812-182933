-- KLYX_PHONE_OTP_SECURITY_12_71

create table if not exists public.phone_verification_limits (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  last_sent_at timestamptz,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.phone_verification_limits
  enable row level security;

revoke all on table public.phone_verification_limits
  from anon, authenticated;

create index if not exists phone_verification_limits_locked_until_idx
  on public.phone_verification_limits (locked_until);

comment on table public.phone_verification_limits is
  'KLYX server-only OTP anti-abuse state.';