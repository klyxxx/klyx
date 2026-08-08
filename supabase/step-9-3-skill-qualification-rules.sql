
create table if not exists public.skill_qualification_rules (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  service_slug text not null,
  rule_level text not null default 'evidence_required'
    check (rule_level in ('self_declared','evidence_required','regulated')),
  required_proof_types text[] not null default '{}',
  accepted_proof_types text[] not null default '{}',
  minimum_years_experience integer not null default 0
    check (minimum_years_experience between 0 and 80),
  identity_required boolean not null default true,
  insurance_required boolean not null default false,
  official_registration_required boolean not null default false,
  official_registration_label text,
  legal_note text,
  source_url text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(country_code, service_slug)
);

create index if not exists skill_qualification_rules_lookup_idx
  on public.skill_qualification_rules(country_code, service_slug, enabled);

alter table public.skill_qualification_rules enable row level security;

insert into public.skill_qualification_rules
(country_code,service_slug,rule_level,required_proof_types,accepted_proof_types,minimum_years_experience,identity_required,insurance_required,official_registration_required,legal_note,enabled)
values
('BE','babysitting','evidence_required',array['training_certificate'],array['training_certificate','diploma','experience_reference'],0,true,false,false,'Règle de confiance KLYX initiale.',true),
('BE','cleaning','evidence_required',array['experience_reference'],array['experience_reference','training_certificate','portfolio'],0,true,false,false,'Règle de confiance KLYX initiale.',true),
('BE','moving','evidence_required',array['experience_reference'],array['experience_reference','training_certificate','insurance'],0,true,false,false,'Règle de confiance KLYX initiale.',true),
('BE','handyman','evidence_required',array['training_certificate'],array['training_certificate','diploma','experience_reference','portfolio'],0,true,false,false,'Règle de confiance KLYX initiale. Certaines sous-activités peuvent exiger des qualifications spécifiques.',true)
on conflict (country_code, service_slug)
do update set
  rule_level=excluded.rule_level,
  required_proof_types=excluded.required_proof_types,
  accepted_proof_types=excluded.accepted_proof_types,
  minimum_years_experience=excluded.minimum_years_experience,
  identity_required=excluded.identity_required,
  insurance_required=excluded.insurance_required,
  official_registration_required=excluded.official_registration_required,
  legal_note=excluded.legal_note,
  enabled=excluded.enabled,
  updated_at=now();
