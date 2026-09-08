# Tolgee translation snapshots

Files in this directory are translation snapshots synchronized with the KLYX Tolgee project.

The committed bootstrap is intentionally limited to `fr`, `en`, `nl`, `de`, and staged `es`. The seed generator still validates and can generate every locale registered by KLYX; CI publishes that complete generated set as a short-lived artifact so the remaining locales can be onboarded progressively.

Use the repository scripts instead of editing synchronization metadata manually:

- `npm run i18n:tolgee:seed:check` validates that the current KLYX shell/navigation dictionaries can be exported for every registered locale.
- `npm run i18n:tolgee:seed` fills missing Tolgee keys from the current KLYX dictionaries without overwriting existing reviewed local values.
- `npm run i18n:tolgee:catalogs:check` verifies that every committed catalog contains all generated seed keys. Reviewed values may differ from the seed; missing keys fail certification.
- `npm run i18n:tolgee:pull` pulls translations from Tolgee.
- `npm run i18n:tolgee:watch` watches Tolgee for translation updates.
- `npm run i18n:tolgee:push` pushes reviewed local translation files with `NO_FORCE` conflict handling.

A locale file existing here does **not** make that locale visible in KLYX. Runtime exposure remains controlled by the certified locale allowlist in `lib/klyx-i18n.ts`.

Spanish therefore has an `es.json` staging baseline while remaining hidden from Settings until its critical surfaces are certified.

Never store Tolgee API keys or personal access tokens in this directory or anywhere else in the repository.
