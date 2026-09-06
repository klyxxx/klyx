# KLYX — Tolgee i18n foundation

This document defines the Tolgee integration path for KLYX.

## Goal

Use Tolgee as the translation-management plane for every locale already registered by KLYX, while keeping runtime exposure conservative.

- Tolgee-managed locales: every locale in `KLYX_LOCALES`.
- Runtime-published locales: only `KLYX_FULLY_TRANSLATED_LOCALES`.
- Spanish (`es`) remains staged and must not appear in Settings until its critical surfaces are certified end-to-end.
- Routing, Supabase, Stripe, accounts, payments and API behavior remain outside the Tolgee migration.

## Why the CLI came first

KLYX already has a large in-repo translation system. Replacing it in one commit would create unnecessary risk and overlap with existing translation work.

The first phases therefore installed a reproducible Tolgee synchronization workflow before changing production translation resolution:

- Tolgee CLI is pinned to `2.20.0` through `npx` scripts.
- No Tolgee package is added to runtime dependencies yet, so `package-lock.json` stays unchanged.
- Translation snapshots live under `messages/tolgee`.
- Tolgee credentials stay outside the repository.
- Existing KLYX shell/navigation translations can be exported as a non-destructive Tolgee seed.

## Seed the existing KLYX translations

KLYX already contains translated shell and navigation dictionaries for every registered locale. The seed exporter turns those existing dictionaries into Tolgee `JSON_TOLGEE` catalogs.

Validate that all registered locale catalogs can be produced:

```powershell
npm run i18n:tolgee:seed:check
```

Generate or update locale files under `messages/tolgee`:

```powershell
npm run i18n:tolgee:seed
```

Validate the committed bootstrap catalogs:

```powershell
npm run i18n:tolgee:catalogs:check
```

The exporter and committed-baseline checker are deliberately non-destructive:

- existing reviewed keys in a local Tolgee JSON file win over generated seed values;
- missing shell/navigation keys are filled from the current KLYX source dictionaries;
- committed catalogs must retain every generated seed key, but reviewed values are allowed to differ;
- navigation fallback behavior mirrors the existing KLYX runtime: locale translation → English → French source label;
- generating or committing an `es.json` file does not publish Spanish in Settings;
- no Tolgee credential is required to build or validate the seed.

The committed bootstrap currently contains `fr`, `en`, `nl`, `de`, and staged `es`. CI also generates every registered KLYX locale into a short-lived artifact, so the remaining locales can move into Tolgee progressively without widening runtime exposure.

The seed currently covers the shared KLYX shell/UI and navigation dictionaries. Page-specific bundles remain on the progressive migration path and must retain their existing certification boundaries until migrated.

## Static runtime bridge

The first production runtime slice is intentionally local and fail-safe.

`KlyxLocaleProvider` resolves its shared shell/UI labels through `lib/klyx-tolgee-runtime.ts`. That bridge:

- imports only the committed runtime-published catalogs: `fr`, `en`, `nl`, and `de`;
- reads `ui.*` keys from those Tolgee snapshots first;
- falls back to the existing `translateKlyxUi` dictionary if a Tolgee key is absent or empty;
- never imports staged `es.json` into the published runtime catalog;
- performs no browser network request;
- reads no Tolgee API key or public environment secret;
- leaves the existing locale storage, cookie, document language/direction and Settings allowlist behavior unchanged.

This means a reviewed Tolgee shell translation can reach KLYX after the normal Tolgee pull → PR → certified deploy flow, while the old dictionaries remain a production fallback during migration.

The runtime catalog is typed against `KlyxSelectableLocale`, so promoting a locale requires the runtime bridge to explicitly provide that locale before TypeScript can pass.

## Tolgee Cloud project

The live Tolgee Cloud project for KLYX is:

- Project name: `klyx`
- Project ID: `34751`
- Tolgee base language: English (`en`)

The Tolgee base language is a translation-management setting only. It does **not** change the KLYX application default locale: KLYX still uses French (`fr`) as `KLYX_DEFAULT_LOCALE` and still publishes only certified locales.

The repository stores the non-secret project id in `.tolgeerc.json`. The Project API Key must never be committed.

When adding languages in Tolgee, prefer the exact KLYX tags whenever Tolgee allows a custom tag (`gu`, `mr`, `pa`, `sr`, `uz`, `zh-Hans`, `zh-Hant`, etc.). Regional/script variants can be normalized by the KLYX browser locale resolver, but exact project tags make CLI file synchronization predictable.

## Project API Key

Create a **Project API Key** for project `34751`. It should have the minimum project permissions needed to read translations for verification; grant write permissions only when intentional Tolgee push synchronization is required.

Never:

- commit the key in `.tolgeerc.json`;
- add it to a `NEXT_PUBLIC_*` variable;
- expose it to the browser;
- print it in CI logs.

Tolgee CLI reads the key from `TOLGEE_API_KEY`.

## Local setup — PowerShell

Set the key only for the current terminal session:

```powershell
$env:TOLGEE_API_KEY = "<project-api-key>"
```

The project id is already configured in `.tolgeerc.json`, so the CLI does not need `--project-id` for normal KLYX commands.

## GitHub Actions secret

For repository-side Cloud verification, add one GitHub Actions repository secret named exactly:

```text
TOLGEE_API_KEY
```

The secret is consumed only by the manual workflow `KLYX Tolgee Cloud Verification`.

That workflow is intentionally read-only against Tolgee:

1. it requires `TOLGEE_API_KEY` without printing it;
2. it pulls only `en`, `fr`, `nl`, `de`, and staged `es` into an ephemeral CI directory;
3. it validates the pulled files against the KLYX Tolgee catalog contract;
4. it does not commit files, deploy code, or push translations back to Tolgee.

This provides a safe first proof that the Tolgee Cloud project, API key and KLYX repository are connected correctly.

## Synchronization commands

Pull all languages configured in the Tolgee project:

```powershell
npm run i18n:tolgee:pull
```

Watch Tolgee and continuously pull translation updates:

```powershell
npm run i18n:tolgee:watch
```

Push reviewed local translation files without silently overwriting conflicting translations:

```powershell
npm run i18n:tolgee:push
```

The repository configuration uses `NO_FORCE` for push conflicts. A conflict must be resolved deliberately rather than overwriting remote work.

Do not use the push command until the Tolgee project language tags intended for synchronization are aligned with the corresponding KLYX catalog filenames.

## Publication invariant

Tolgee management and KLYX runtime publication are separate concerns.

A locale may exist in `messages/tolgee` and in the Tolgee project while remaining hidden in KLYX. Promotion to Settings is controlled by `KLYX_FULLY_TRANSLATED_LOCALES` and requires a separate certified KLYX change.

For Spanish specifically:

- Tolgee may store, seed and synchronize `es` now.
- `es` remains outside `KLYX_TOLGEE_PUBLISHED_LOCALES`.
- `es` remains absent from the static runtime catalog.
- `es` remains absent from Settings.
- Existing Spanish certification PRs stay valid and isolated.

## Progressive runtime migration

Continue one surface at a time:

1. keep the static shell bridge and the existing KLYX dictionary fallback;
2. migrate shared navigation labels to the same Tolgee snapshots in a separate certified PR;
3. verify Tolgee Cloud through the read-only manual workflow before enabling any automated push path;
4. evaluate the current Tolgee React/Next.js SDK without changing the language-selection contract;
5. migrate page-specific translation bundles independently, preserving their safety tests;
6. keep local static data as a production fallback until the migration is complete;
7. expose a new locale only after its critical KLYX surfaces are certified end-to-end.
