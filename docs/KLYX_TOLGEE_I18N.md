# KLYX — Tolgee i18n foundation

This document defines the first Tolgee integration phase for KLYX.

## Goal

Use Tolgee as the translation-management plane for every locale already registered by KLYX, while keeping runtime exposure conservative.

- Tolgee-managed locales: every locale in `KLYX_LOCALES`.
- Runtime-published locales: only `KLYX_FULLY_TRANSLATED_LOCALES`.
- Spanish (`es`) remains staged and must not appear in Settings until its critical surfaces are certified end-to-end.
- This phase does not change routing, `KlyxLocaleProvider`, Supabase, Stripe, accounts, payments, or API behavior.

## Why the CLI comes first

KLYX already has a large in-repo translation system. Replacing it in one commit would create unnecessary risk and overlap with the existing Spanish certification PRs.

The first phase therefore installs a reproducible Tolgee synchronization workflow without changing the production runtime:

- Tolgee CLI is pinned to `2.20.0` through `npx` scripts.
- No Tolgee package is added to runtime dependencies yet, so `package-lock.json` stays unchanged.
- Translation snapshots live under `messages/tolgee`.
- Tolgee credentials stay outside the repository.

A later isolated phase can add the Tolgee React/Next.js runtime SDK and migrate page bundles progressively after the Tolgee project is connected and seeded.

## Create the Tolgee project

Recommended initial setup:

1. Create a Tolgee Cloud project named `KLYX`.
2. Use French (`fr`) as the base language.
3. Add `en`, `nl`, `de`, and `es` first.
4. Add the remaining KLYX registered locales progressively in Tolgee. They can exist in Tolgee without being exposed in KLYX.
5. Create a Project API Key for CLI synchronization.

Do not commit the API key and do not put the management key in a `NEXT_PUBLIC_*` environment variable.

## Local setup — PowerShell

Set the key only for the current terminal session:

```powershell
$env:TOLGEE_API_KEY = "<project-api-key>"
```

If you use a Personal Access Token instead of a Project API Key, pass the project id to the Tolgee CLI according to Tolgee documentation.

## Commands

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

## Publication invariant

Tolgee management and KLYX runtime publication are separate concerns.

A locale may exist in `messages/tolgee` and in the Tolgee project while remaining hidden in KLYX. Promotion to Settings is controlled by `KLYX_FULLY_TRANSLATED_LOCALES` and requires a separate certified KLYX change.

For Spanish specifically:

- Tolgee may store and synchronize `es` now.
- `es` remains outside `KLYX_TOLGEE_PUBLISHED_LOCALES`.
- `es` remains absent from Settings.
- Existing page-by-page Spanish certification PRs stay valid and isolated.

## Next phase

After the Tolgee Cloud project is created and the initial translations are synchronized, migrate the runtime in a separate branch:

1. add the current Tolgee React/Next.js SDK;
2. wrap the runtime without changing the existing language-selection contract;
3. migrate one translation surface at a time to Tolgee static data;
4. keep local static translation data as the production fallback;
5. only expose a new locale after KLYX certification is complete.
