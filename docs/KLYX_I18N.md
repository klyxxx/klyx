# KLYX internationalization

## Current translated shell locales

KLYX has a real translated global-shell foundation for 64 selectable locales:

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

### Batch 9 — South Asia extension
- `si` — සිංහල
- `pa` — ਪੰਜਾਬੀ
- `gu` — ગુજરાતી
- `kn` — ಕನ್ನಡ

### Batch 10 — Southeast and Central Asia
- `my` — မြန်မာ
- `km` — ខ្មែរ
- `lo` — ລາວ
- `mn` — Монгол

### Batch 11 — Europe extension
- `sq` — Shqip
- `mk` — Македонски
- `is` — Íslenska
- `ga` — Gaeilge

Only locales whose global shell strings and navigation labels are actually present are exposed in the KLYX language selector. Do not add a selectable locale that silently falls back to another language.

The user preference reuses the existing `klyx_language` browser-storage key. The locale provider mirrors the current locale into the non-secret `klyx_locale` cookie so the server-rendered shell can reuse the same preference without inventing a second setting.

## What this foundation does

- normalizes supported browser locale variants such as `fr-BE`, `en-US`, `de-CH`, `es-MX`, `pt-BR`, `ar-MA`, `ru-RU`, `hi-IN`, `ur-PK`, `he-IL`, `fa-IR`, `id-ID`, `sv-SE`, `fi-FI`, `cs-CZ`, `ro-RO`, `sr-RS`, `lt-LT`, `lv-LV`, `et-EE`, `sl-SI`, `ms-MY`, `fil-PH`, `sw-KE`, `af-ZA`, `ka-GE`, `hy-AM`, `kk-KZ`, `uz-UZ`, `ta-IN`, `te-IN`, `mr-IN`, `ne-NP`, `si-LK`, `pa-IN`, `gu-IN`, `kn-IN`, `my-MM`, `km-KH`, `lo-LA`, `mn-MN`, `sq-AL`, `mk-MK`, `is-IS`, `ga-IE`, `zh-CN` and `zh-TW`;
- supports legacy browser aliases where applicable (`iw` → `he`, `in` → `id`);
- falls back safely to French for unsupported locale identifiers in the canonical locale resolver;
- resolves the initial server locale from the persisted `klyx_locale` cookie, then from the browser `Accept-Language` preference when no saved cookie exists;
- renders the initial HTML `lang` and `dir` from the resolved locale before hydration, including RTL locales;
- hydrates the client locale provider from the same server-selected locale so the application shell does not intentionally start in French and switch language afterward;
- persists the explicit user selection and synchronizes it across tabs through the browser `storage` event;
- translates the global skip link;
- translates the authenticated client/provider/admin navigation shell in every selectable locale;
- lets navigation search match translated labels while retaining the existing French keywords;
- keeps route paths, service slugs, database enums and transaction identifiers language-neutral;
- provides locale-aware root metadata for the current FR/EN/NL/DE product-translation coverage and uses an explicit English metadata fallback for other selectable locales instead of pretending those metadata have been reviewed in every language;
- keeps the universal service selector chrome localized for FR/EN/NL/DE with an English fallback for the remaining selectable locales;
- tests batch completeness so a selectable locale cannot silently ship with missing shell/navigation strings.

## What is not complete yet

This tranche is **not** full-site internationalization. Significant page-level coverage is still incomplete outside the deliberately migrated surfaces, especially across the long-tail of the 64 selectable shell locales. E-mails, notification content stored by backend workflows, country-specific legal/compliance content and some product screens still require deliberate translation and review.

FR/EN/NL/DE currently have the deepest reviewed page-level coverage. The other selectable locales have a translated global shell/navigation foundation, but that must not be presented as equivalent full-product translation coverage.

Do not mark KLYX “fully internationalized” merely because the shell, SSR locale or selected page families change language. A locale is not considered full-product ready until the relevant client, provider, legal and transactional surfaces have been translated and reviewed.

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
2. preserve its documented fallback behavior;
3. keep accessibility labels in the active language;
4. avoid translating machine identifiers, service slugs, database enums, Stripe status codes or audit identifiers;
5. preserve transactional meaning exactly across languages;
6. add tests for the translated behavior/search path where applicable;
7. pass Vitest, TypeScript, production build and protected Playwright verification.

Complete route/page coverage, reviewed metadata for every selectable locale and market-specific legal/compliance translation remain follow-up work. Route structure is intentionally unchanged to avoid a risky global URL migration before the translation inventory is complete.
