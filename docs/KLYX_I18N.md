# KLYX internationalization

## Current translated shell locales

KLYX has a translated global-shell foundation for **56 registered locales**. Registration means locale metadata, normalization, shell copy and navigation packs exist; it does **not** mean every product page is translated.

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

## Selectable application locales

A locale is selectable in Settings only when the critical product page bundles are translated end-to-end. The current selectable set is:

- `fr` — Français
- `en` — English
- `nl` — Nederlands
- `de` — Deutsch

The other 52 registered locales stay in the translation engine while their page families are completed. They must not be exposed as full application languages and silently fall back to French. `KLYX_REGISTERED_LANGUAGE_OPTIONS` owns the 56 registered packs; `KLYX_LANGUAGE_OPTIONS` contains only end-to-end selectable locales.

The user preference reuses the existing `klyx_language` browser-storage key. The locale provider mirrors the current locale into the non-secret `klyx_locale` cookie so the server-rendered shell can reuse the same preference without inventing a second setting. Saved or browser locales that are registered but not yet end-to-end complete are clamped to a selectable locale instead of producing mixed-language screens.

## What this foundation does

- normalizes registered browser locale variants such as `fr-BE`, `en-US`, `de-CH`, `es-MX`, `pt-BR`, `ar-MA`, `ru-RU`, `hi-IN`, `ur-PK`, `he-IL`, `fa-IR`, `id-ID`, `sv-SE`, `fi-FI`, `cs-CZ`, `ro-RO`, `sr-RS`, `lt-LT`, `lv-LV`, `et-EE`, `sl-SI`, `ms-MY`, `fil-PH`, `sw-KE`, `af-ZA`, `ka-GE`, `hy-AM`, `kk-KZ`, `uz-UZ`, `ta-IN`, `te-IN`, `mr-IN`, `ne-NP`, `si-LK`, `pa-IN`, `gu-IN`, `kn-IN`, `my-MM`, `km-KH`, `lo-LA`, `mn-MN`, `sq-AL`, `mk-MK`, `is-IS`, `ga-IE`, `zh-CN` and `zh-TW`;
- supports legacy browser aliases where applicable (`iw` → `he`, `in` → `id`);
- falls back safely to French for unsupported locale identifiers in the canonical registered-locale resolver;
- resolves the initial server application locale from the persisted `klyx_locale` cookie, then from the browser `Accept-Language` preference, while skipping registered locales that are not yet end-to-end selectable;
- renders the initial HTML `lang` and `dir` from the same selectable locale used by page content;
- hydrates the client locale provider from the same server-selected locale so SSR and client rendering stay aligned;
- persists the explicit user selection and synchronizes it across tabs through the browser `storage` event;
- keeps all 56 registered shell/navigation translation packs available for continued rollout;
- translates the global skip link and authenticated client/provider/admin navigation shell for registered locale packs;
- lets navigation search match translated labels while retaining the existing French keywords;
- keeps route paths, service slugs, database enums and transaction identifiers language-neutral;
- provides reviewed root metadata for the current FR/EN/NL/DE product-translation coverage;
- keeps the universal service selector chrome localized for FR/EN/NL/DE;
- tests selectable-locale integrity so an incomplete page locale cannot silently ship as a full app language.

## What is not complete yet

This tranche is **not** full-site internationalization. Significant page-level coverage is still incomplete outside FR/EN/NL/DE and deliberately migrated surfaces. Most page-level copy in the remaining 52 registered locales still requires deliberate translation and review. E-mails, notification content stored by backend workflows, country-specific legal/compliance content and some product screens also require deliberate translation and review.

FR/EN/NL/DE currently have the deepest reviewed page-level coverage and are the only end-to-end selectable application locales. The other registered locales retain a translated global shell/navigation foundation so work already completed is not discarded.

Do not mark KLYX “fully internationalized” merely because the shell, SSR locale or selected page families change language. A locale is not considered full-product ready until the relevant client, provider, legal and transactional surfaces have been translated and reviewed.

## Global-language rollout rule

KLYX should continue adding languages in verified batches rather than exposing fake options. A registered locale must first have:

1. native language label and canonical BCP-47/HTML language metadata;
2. correct text direction (`ltr` or `rtl`);
3. all global shell messages translated;
4. all global navigation labels and groups translated;
5. regional/legacy browser aliases where needed;
6. normalization, search and accessibility tests;
7. a completeness test proving all canonical shell/navigation keys exist.

Then migrate page families in bounded PRs. Each migrated surface should:

1. use shared typed translation keys or a documented translation helper;
2. preserve its documented fallback behavior while the locale is not selectable;
3. keep accessibility labels in the active language;
4. avoid translating machine identifiers, service slugs, database enums, Stripe status codes or audit identifiers;
5. preserve transactional meaning exactly across languages;
6. add tests for the translated behavior/search path where applicable;
7. pass Vitest, TypeScript, production build and protected Playwright verification.

A registered locale may enter `KLYX_FULLY_TRANSLATED_LOCALES` only after its critical client, provider, legal and transactional surfaces have real reviewed copy. Complete route/page coverage, reviewed metadata and market-specific legal/compliance translation remain follow-up work. Route structure is intentionally unchanged to avoid a risky global URL migration before the translation inventory is complete.
