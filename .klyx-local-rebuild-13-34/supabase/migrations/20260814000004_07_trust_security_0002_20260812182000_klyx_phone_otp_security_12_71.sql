-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations\20260812182000_klyx_phone_otp_security_12_71.sql
-- SHA256: 84e658ee97318b75022c2edca5672c57d89c6a61a6c8138e38acbc7d88e8e5fd
-- PHASE: 07_trust_security
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
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