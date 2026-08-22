# KLYX internationalization

## Current translated shell locales

KLYX has a real translated global-shell foundation for 52 selectable locales:

### Batch 1
- `fr` — Français (default/fallback)
- `en` — English
- `nl` — Nederlands
- `de` — Deutsch
- `es` — Español
- `it` — Italiano
- `pt` — Português, including `pt-BR` / `pt-PT`
- `ar` — العربية (RTL)
- `zh-hans` — 简体中文, including `zh-CN` / `zh-SG`
- `zh-hant` — 繁體中文, including `zh-TW` / `zh-HK` / `zh-MO`
- `ja` — 日本語
- `ko` — 한국어

### Batch 2
- `ru` — Русский
- `uk` — Українська
- `pl` — Polski
- `tr` — Türkçe
- `hi` — हिन्दी
- `ur` — اردو (RTL)
- `he` — עברית (RTL), including legacy browser alias `iw`
- `fa` — فارسی (RTL)
- `id` — Bahasa Indonesia, including legacy browser alias `in`
- `vi` — Tiếng Việt
- `th` — ไทย
- `bn` — বাংলা

### Batch 3 — Nordics
- `sv` — Svenska
- `da` — Dansk
- `no` — Norsk
- `fi` — Suomi

### Batch 4 — Central Europe and Balkans
- `cs` — Čeština
- `sk` — Slovenčina
- `hu` — Magyar
- `ro` — Română
- `el` — Ελληνικά
- `bg` — Български
- `hr` — Hrvatski
- `sr` — Српски

### Batch 5 — Baltics and Slovenia
- `lt` — Lietuvių
- `lv` — Latviešu
- `et` — Eesti
- `sl` — Slovenščina

### Batch 6 — Southeast Asia and Africa
- `ms` — Bahasa Melayu
- `fil` — Filipino
- `sw` — Kiswahili
- `af` — Afrikaans

### Batch 7 — Caucasus and Central Asia
- `ka` — ქართული
- `hy` — Հայերեն
- `kk` — Қазақша
- `uz` — O‘zbekcha

### Batch 8 — South Asia
- `ta` — தமிழ்
- `te` — తెలుగు
- `mr` — मराठी
- `ne` — नेपाली

Only locales whose global shell strings and navigation labels are actually present are exposed in the KLYX language selector. Do not add a selectable locale that silently falls back to another language.

The user preference reuses the existing `klyx_language` browser-storage key. The locale provider also mirrors the current locale into a non-secret `klyx_locale` cookie so a future server-rendered locale layer can use the same preference without inventing a second setting.

## What this foundation does

- normalizes supported browser locale variants such as `fr-BE`, `en-US`, `de-CH`, `es-MX`, `pt-BR`, `ar-MA`, `ru-RU`, `hi-IN`, `ur-PK`, `he-IL`, `fa-IR`, `id-ID`, `sv-SE`, `fi-FI`, `cs-CZ`, `ro-RO`, `sr-RS`, `lt-LT`, `lv-LV`, `et-EE`, `sl-SI`, `ms-MY`, `fil-PH`, `sw-KE`, `af-ZA`, `ka-GE`, `hy-AM`, `kk-KZ`, `uz-UZ`, `ta-IN`, `te-IN`, `mr-IN`, `ne-NP`, `zh-CN` and `zh-TW`;
- supports legacy browser aliases where applicable (`iw` → `he`, `in` → `id`);
- falls back safely to French for unsupported locales;
- detects the first supported browser language when no saved preference exists;
- updates both `document.documentElement.lang` and `document.documentElement.dir` after hydration;
- persists the explicit user selection;
- synchronizes the preference across tabs through the browser `storage` event;
- translates the global skip link;
- translates the authenticated client/provider/admin navigation shell in every selectable locale;
- lets navigation search match translated labels while retaining the existing French keywords;
- keeps route paths, service slugs, database enums and transaction identifiers language-neutral;
- tests batch completeness so a selectable locale cannot silently ship with missing shell/navigation strings.

## What is not complete yet

This tranche is **not** full-site internationalization. Most page-level copy, validation errors, transactional screens, legal pages, e-mails/notifications and server-rendered metadata remain French until migrated deliberately.

Do not mark KLYX “fully internationalized” merely because the shell changes language. A locale is not considered full-product ready until the relevant client, provider, legal and transactional surfaces have been translated and reviewed.

## Global-language rollout rule

KLYX should continue adding languages in verified batches rather than exposing fake options. Each new selectable locale must have, at minimum:

1. native language label and canonical BCP-47/HTML language metadata;
2. correct text direction (`ltr` or `rtl`);
3. all global shell messages translated;
4. all global navigation labels and groups translated;
5. regional/legacy browser aliases where needed;
6. normalization, search and accessibility tests;
7. a completeness test proving all canonical shell/navigation keys exist.

Then migrate page families in bounded PRs. Each migrated surface should:

1. use shared typed translation keys or a documented translation helper;
2. preserve French as the fallback;
3. keep accessibility labels in the active language;
4. avoid translating machine identifiers, service slugs, database enums, Stripe status codes or audit identifiers;
5. preserve transactional meaning exactly across languages;
6. add tests for the translated behavior/search path where applicable;
7. pass Vitest, TypeScript, production build and protected Playwright verification.

Server-rendered locale-specific metadata and complete route/page coverage remain follow-up work. Route structure is intentionally unchanged in this foundation to avoid a risky global URL migration before the translation inventory is complete.
