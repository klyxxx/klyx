# Tolgee translation snapshots

Files in this directory are translation snapshots synchronized with the KLYX Tolgee project.

Use the repository scripts instead of editing synchronization metadata manually:

- `npm run i18n:tolgee:pull`
- `npm run i18n:tolgee:watch`
- `npm run i18n:tolgee:push`

A locale file existing here does **not** make that locale visible in KLYX. Runtime exposure remains controlled by the certified locale allowlist in `lib/klyx-i18n.ts`.

Never store Tolgee API keys or personal access tokens in this directory or anywhere else in the repository.
