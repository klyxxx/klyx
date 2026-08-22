# KLYX internationalization

## Current supported UI locales

KLYX now has an internal locale foundation for:

- `fr` — Français (default/fallback)
- `en` — English
- `nl` — Nederlands

The user preference reuses the existing `klyx_language` browser-storage key. The locale provider also mirrors the current locale into a non-secret `klyx_locale` cookie so a future server-rendered locale layer can use the same preference without inventing a second setting.

## What this foundation does

- normalizes browser locale variants such as `fr-BE`, `en-US` and `nl-BE`;
- falls back safely to French for unsupported locales;
- detects the first supported browser language when no saved preference exists;
- updates `document.documentElement.lang` after hydration;
- persists the explicit user selection;
- synchronizes the preference across tabs through the browser `storage` event;
- translates the global skip link;
- translates the authenticated client/provider navigation shell in French, English and Dutch;
- lets navigation search match translated English/Dutch labels while retaining the existing French keywords.

## What is not complete yet

This first tranche is **not** full-site internationalization. Most page-level copy, validation errors, transactional screens, legal pages, e-mails/notifications and metadata remain French until migrated deliberately.

Do not mark KLYX “fully internationalized” merely because the shell changes language.

## Rollout rule

Migrate page families in bounded PRs. Each migrated surface should:

1. use shared typed translation keys or a documented translation helper;
2. preserve French as the fallback;
3. keep accessibility labels in the active language;
4. avoid translating machine identifiers, service slugs, database enums, Stripe status codes or audit identifiers;
5. preserve transactional meaning exactly across languages;
6. add tests for the translated behavior/search path where applicable;
7. pass Vitest, TypeScript, production build and protected Playwright verification.

Server-rendered locale-specific metadata and complete route/page coverage remain follow-up work. Route structure is intentionally unchanged in this foundation to avoid a risky global URL migration before the translation inventory is complete.
