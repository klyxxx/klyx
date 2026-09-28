-- KLYX native mobile push delivery (APNs + FCM)
-- Canonical user_notifications stays the source of truth.
-- This migration adds only device registration + durable delivery projection.

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.mobile_push_installations (
  installation_id uuid primary key,
  account_id uuid not null
    references public.accounts(id) on delete cascade,
  auth_user_id uuid not null
    references auth.users(id) on delete cascade,
  platform text not null,
  native_token text not null,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_push_installations_platform_check
    check (platform in ('ios', 'android')),
  constraint mobile_push_installations_token_check
    check (char_length(native_token) between 16 and 8192)
);

create unique index if not exists mobile_push_installations_active_token_key
  on public.mobile_push_installations (platform, native_token)
  where enabled = true;

create index if not exists mobile_push_installations_account_enabled_idx
  on public.mobile_push_installations (account_id, enabled, last_seen_at desc);

alter table public.mobile_push_installations enable row level security;
revoke all on table public.mobile_push_installations
  from public, anon, authenticated;
grant all on table public.mobile_push_installations
  to service_role;

create table if not exists public.mobile_push_outbox (
  id uuid default gen_random_uuid() primary key,
  notification_id uuid not null
    references public.user_notifications(id) on delete cascade,
  installation_id uuid not null
    references public.mobile_push_installations(installation_id) on delete cascade,
  recipient_profile_id uuid not null
    references public.profiles(id) on delete cascade,
  state text not null default 'pending',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  lease_owner text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_push_outbox_state_check
    check (state in ('pending', 'processing', 'retry', 'sent', 'dead')),
  constraint mobile_push_outbox_attempt_check
    check (attempt_count >= 0),
  constraint mobile_push_outbox_notification_installation_key
    unique (notification_id, installation_id)
);

create index if not exists mobile_push_outbox_ready_idx
  on public.mobile_push_outbox (state, available_at, created_at)
  where state in ('pending', 'retry', 'processing');

alter table public.mobile_push_outbox enable row level security;
revoke all on table public.mobile_push_outbox
  from public, anon, authenticated;
grant all on table public.mobile_push_outbox
  to service_role;

create table if not exists public.ops_mobile_push_scheduler (
  scheduler_key text primary key,
  enabled boolean not null default false,
  target_origin text not null,
  token_sha256 text,
  updated_at timestamptz not null default now(),
  constraint ops_mobile_push_scheduler_key_check
    check (scheduler_key = 'mobile_push_tick'),
  constraint ops_mobile_push_scheduler_origin_check
    check (target_origin ~ '^https://'),
  constraint ops_mobile_push_scheduler_token_hash_check
    check (token_sha256 is null or token_sha256 ~ '^[0-9a-f]{64}$')
);

alter table public.ops_mobile_push_scheduler enable row level security;
revoke all on table public.ops_mobile_push_scheduler
  from public, anon, authenticated;
grant select, update on table public.ops_mobile_push_scheduler
  to service_role;

insert into public.ops_mobile_push_scheduler (
  scheduler_key,
  enabled,
  target_origin,
  token_sha256
)
values (
  'mobile_push_tick',
  false,
  'https://www.klyx.be',
  null
)
on conflict (scheduler_key) do nothing;

create or replace function public.klyx_invoke_mobile_push_tick()
returns bigint
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_enabled boolean;
  v_origin text;
  v_token text;
  v_request_id bigint;
begin
  select enabled, target_origin
    into v_enabled, v_origin
  from public.ops_mobile_push_scheduler
  where scheduler_key = 'mobile_push_tick';

  if coalesce(v_enabled, false) is not true then
    return null;
  end if;

  select decrypted_secret
    into v_token
  from vault.decrypted_secrets
  where name = 'klyx_mobile_push_scheduler_token'
  order by created_at desc
  limit 1;

  if coalesce(trim(v_token), '') = '' then
    return null;
  end if;

  select net.http_post(
    url := rtrim(v_origin, '/') || '/api/ops/mobile-push-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body := jsonb_build_object(
      'source', 'supabase-mobile-push',
      'scheduled_at', now()
    ),
    timeout_milliseconds := 50000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.klyx_invoke_mobile_push_tick()
  from public, anon, authenticated;
grant execute on function public.klyx_invoke_mobile_push_tick()
  to service_role;

create or replace function public.klyx_enqueue_mobile_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted integer := 0;
begin
  insert into public.mobile_push_outbox (
    notification_id,
    installation_id,
    recipient_profile_id
  )
  select
    new.id,
    installation.installation_id,
    new.user_id
  from public.profiles as profile
  join public.accounts as account
    on account.id = profile.account_id
   and account.auth_user_id = profile.owner_user_id
  join public.mobile_push_installations as installation
    on installation.account_id = account.id
   and installation.auth_user_id = account.auth_user_id
   and installation.enabled = true
   and installation.invalidated_at is null
  where profile.id = new.user_id
  on conflict (notification_id, installation_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    perform public.klyx_invoke_mobile_push_tick();
  end if;

  return new;
end;
$$;

revoke all on function public.klyx_enqueue_mobile_push()
  from public, anon, authenticated;
grant execute on function public.klyx_enqueue_mobile_push()
  to service_role;

drop trigger if exists klyx_user_notification_mobile_push
  on public.user_notifications;
create trigger klyx_user_notification_mobile_push
after insert on public.user_notifications
for each row
execute function public.klyx_enqueue_mobile_push();

create or replace function public.klyx_claim_mobile_push_outbox(
  p_worker text,
  p_limit integer default 25
)
returns table (
  id uuid,
  notification_id uuid,
  installation_id uuid,
  recipient_profile_id uuid,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(trim(p_worker), '') = '' then
    raise exception 'KLYX_MOBILE_PUSH_WORKER_REQUIRED';
  end if;

  return query
  with candidates as (
    select queue.id
    from public.mobile_push_outbox as queue
    where queue.attempt_count < 7
      and (
        (
          queue.state in ('pending', 'retry')
          and queue.available_at <= now()
        )
        or (
          queue.state = 'processing'
          and queue.claimed_at < now() - interval '5 minutes'
        )
      )
    order by queue.available_at asc, queue.created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  update public.mobile_push_outbox as queue
     set state = 'processing',
         attempt_count = queue.attempt_count + 1,
         claimed_at = now(),
         lease_owner = p_worker,
         last_error = null,
         updated_at = now()
    from candidates
   where queue.id = candidates.id
  returning
    queue.id,
    queue.notification_id,
    queue.installation_id,
    queue.recipient_profile_id,
    queue.attempt_count;
end;
$$;

revoke all on function public.klyx_claim_mobile_push_outbox(text, integer)
  from public, anon, authenticated;
grant execute on function public.klyx_claim_mobile_push_outbox(text, integer)
  to service_role;

do $$
declare
  v_jobid bigint;
begin
  select jobid
    into v_jobid
  from cron.job
  where jobname = 'klyx-mobile-push-tick'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'klyx-mobile-push-tick',
    '* * * * *',
    'select public.klyx_invoke_mobile_push_tick();'
  );
end;
$$;

comment on table public.mobile_push_installations is
  'Server-only APNs/FCM native device tokens bound to the canonical KLYX account, never to client authority.';
comment on table public.mobile_push_outbox is
  'Durable idempotent projection of canonical user_notifications to one native installation delivery.';
comment on table public.ops_mobile_push_scheduler is
  'Fail-closed wake-up configuration. Raw scheduler token exists only in Supabase Vault.';

commit;
