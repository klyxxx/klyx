-- KLYX_PHONE_CONTACT_AUDIT_12_72

create table if not exists public.phone_contact_access_logs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  viewer_profile_id uuid not null references public.profiles(id) on delete cascade,
  contact_profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null default 'phone_reveal',
  created_at timestamptz not null default now()
);

alter table public.phone_contact_access_logs
  enable row level security;

revoke all on table public.phone_contact_access_logs
  from anon, authenticated;

create index if not exists phone_contact_logs_booking_idx
  on public.phone_contact_access_logs (booking_id, created_at desc);

create index if not exists phone_contact_logs_viewer_idx
  on public.phone_contact_access_logs (viewer_profile_id, created_at desc);

comment on table public.phone_contact_access_logs is
  'KLYX server-only audit trail for authorized phone reveals.';