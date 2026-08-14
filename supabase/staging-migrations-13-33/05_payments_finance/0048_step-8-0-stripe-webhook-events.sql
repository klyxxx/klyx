-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\step-8-0-stripe-webhook-events.sql
-- SHA256: dce91e84696fdc392e2eb68cfd4caa8a3340c22cb117aa96b2a00770d2c524e5
-- PHASE: 05_payments_finance
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
-- KLYX STEP 8.0
-- Journal idempotent des webhooks Stripe.
-- À exécuter UNE FOIS dans Supabase SQL Editor avant le déploiement du code 8.0.

create extension if not exists pgcrypto;

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  object_id text,
  livemode boolean not null default false,
  api_version text,
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'failed')),
  attempt_count integer not null default 1
    check (attempt_count >= 1),
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_status_idx
  on public.stripe_webhook_events(status, updated_at desc);

create index if not exists stripe_webhook_events_type_idx
  on public.stripe_webhook_events(event_type, received_at desc);

alter table public.stripe_webhook_events enable row level security;

-- Aucune policy utilisateur volontairement.
-- Le serveur KLYX utilise la service role via supabaseAdmin.
-- Les clients ne doivent jamais lire/écrire ce journal Stripe.

comment on table public.stripe_webhook_events is
  'Journal serveur KLYX des événements Stripe pour idempotence et audit.';

comment on column public.stripe_webhook_events.stripe_event_id is
  'Identifiant Stripe evt_... unique, utilisé pour empêcher le double traitement.';
