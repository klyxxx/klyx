-- ============================================================
-- KLYX 14.20 - PROFILE COUNTRY + CURRENCY FOUNDATION
-- KLYX_PROFILE_MARKETS_DB_14_20
--
-- Additif uniquement.
-- Aucun profil existant n'est supprimé.
-- Les anciennes lignes restent compatibles grâce aux colonnes NULL.
-- ============================================================

begin;

alter table public.profiles
  add column if not exists country_code text;

alter table public.profiles
  add column if not exists currency_code text;

-- ------------------------------------------------------------
-- Normalisation future des valeurs
-- ------------------------------------------------------------

alter table public.profiles
  drop constraint if exists profiles_country_code_klyx_check;

alter table public.profiles
  add constraint profiles_country_code_klyx_check
  check (
    country_code is null
    or country_code in ('AD', 'AG', 'AI', 'AS', 'AT', 'AU', 'AX', 'BB', 'BE', 'BG', 'BL', 'BM', 'BN', 'BQ', 'BS', 'BZ', 'CA', 'CC', 'CK', 'CX', 'CY', 'DE', 'DM', 'EC', 'EE', 'ES', 'FI', 'FJ', 'FM', 'FR', 'GD', 'GF', 'GP', 'GR', 'GU', 'GY', 'HK', 'HR', 'IE', 'IT', 'JM', 'KI', 'KN', 'KY', 'LC', 'LR', 'LT', 'LU', 'LV', 'MC', 'ME', 'MF', 'MH', 'MP', 'MQ', 'MS', 'MT', 'NA', 'NF', 'NL', 'NR', 'NU', 'NZ', 'PA', 'PM', 'PN', 'PR', 'PT', 'PW', 'RE', 'SB', 'SG', 'SI', 'SK', 'SM', 'SR', 'SV', 'TC', 'TF', 'TK', 'TL', 'TT', 'TV', 'TW', 'US', 'VA', 'VC', 'VG', 'VI', 'XK', 'YT')
  );

alter table public.profiles
  drop constraint if exists profiles_currency_code_klyx_check;

alter table public.profiles
  add constraint profiles_currency_code_klyx_check
  check (
    currency_code is null
    or currency_code in ('AUD', 'BBD', 'BMD', 'BND', 'BSD', 'BZD', 'CAD', 'EUR', 'FJD', 'GYD', 'HKD', 'JMD', 'KYD', 'LRD', 'NAD', 'NZD', 'SBD', 'SGD', 'SRD', 'TTD', 'TWD', 'USD', 'XCD')
  );

-- ------------------------------------------------------------
-- Cohérence : pays et devise doivent être renseignés ensemble
-- ------------------------------------------------------------

alter table public.profiles
  drop constraint if exists profiles_market_pair_klyx_check;

alter table public.profiles
  add constraint profiles_market_pair_klyx_check
  check (
    (
      country_code is null
      and currency_code is null
    )
    or
    (
      country_code is not null
      and currency_code is not null
    )
  );

-- ------------------------------------------------------------
-- Index utile pour futurs filtres géographiques
-- ------------------------------------------------------------

create index if not exists
  profiles_country_code_klyx_idx
on public.profiles(country_code);

-- KLYX_PROFILE_MARKETS_VERIFY_14_20
select
  count(*) as total_profiles,
  count(country_code) as profiles_with_country,
  count(currency_code) as profiles_with_currency
from public.profiles;

commit;

-- KLYX_EUR_DOLLAR_PROFILE_FOUNDATION_READY_14_20