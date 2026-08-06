begin;

create table if not exists public.profile_risk_assessments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  risk_score integer not null default 0,
  risk_level text not null default 'low',
  signals jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  assessed_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint profile_risk_score_check check (
    risk_score between 0 and 100
  ),
  constraint profile_risk_level_check check (
    risk_level = any (
      array[
        'low'::text,
        'moderate'::text,
        'high'::text,
        'critical'::text
      ]
    )
  )
);

create unique index if not exists profile_risk_assessments_profile_unique
  on public.profile_risk_assessments(profile_id);

create index if not exists profile_risk_assessments_level_idx
  on public.profile_risk_assessments(risk_level, assessed_at desc);

create table if not exists public.security_alerts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  alert_type text not null,
  severity text not null default 'info',
  title text not null,
  description text not null,
  status text not null default 'open',
  deduplication_key text null,
  created_at timestamp with time zone not null default now(),
  resolved_at timestamp with time zone null,
  constraint security_alerts_type_check check (
    alert_type = any (
      array[
        'repeated_cancellations'::text,
        'multiple_disputes'::text,
        'payment_failures'::text,
        'identity_incomplete'::text,
        'unusual_activity'::text,
        'safety_report'::text
      ]
    )
  ),
  constraint security_alerts_severity_check check (
    severity = any (
      array[
        'info'::text,
        'warning'::text,
        'high'::text,
        'critical'::text
      ]
    )
  ),
  constraint security_alerts_status_check check (
    status = any (
      array[
        'open'::text,
        'acknowledged'::text,
        'resolved'::text
      ]
    )
  )
);

create unique index if not exists security_alerts_deduplication_unique
  on public.security_alerts(deduplication_key)
  where deduplication_key is not null;

create index if not exists security_alerts_profile_idx
  on public.security_alerts(profile_id, created_at desc);

alter table public.profile_risk_assessments enable row level security;
alter table public.security_alerts enable row level security;

drop policy if exists "Profiles read own risk assessment"
  on public.profile_risk_assessments;

create policy "Profiles read own risk assessment"
on public.profile_risk_assessments
for select
to authenticated
using (
  profile_id in (
    select id
    from public.profiles
    where owner_user_id = auth.uid()
  )
);

drop policy if exists "Profiles read own security alerts"
  on public.security_alerts;

create policy "Profiles read own security alerts"
on public.security_alerts
for select
to authenticated
using (
  profile_id in (
    select id
    from public.profiles
    where owner_user_id = auth.uid()
  )
);

commit;
