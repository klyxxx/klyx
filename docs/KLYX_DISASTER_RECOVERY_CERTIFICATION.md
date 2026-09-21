# KLYX Disaster Recovery Certification

Mission 18 defines the final, fail-closed disaster-recovery certification gate for KLYX.

Merging this mission installs the certification mechanism. It does **not** by itself mean that production disaster recovery is certified.

KLYX is DR-certified only when the manual certification workflow succeeds for one exact `main` commit.

## Certification invariant

All evidence must refer to the same 40-character Git SHA.

A certification is valid only when all three independent evidence domains pass:

1. verified source backup for the exact commit;
2. full cloud restore drill for DB + Auth + Storage on isolated Supabase;
3. offsite encrypted `.klyxdr` restore drill for the exact commit.

Missing, stale, mismatched or unverifiable evidence means:

```text
NOT CERTIFIED
```

No partial proof may be promoted to full DR certification.

## Evidence 1 — Source recovery

`KLYX Source Backup` continues to create a verified repository archive on push to `main`, daily schedule, or manual dispatch.

Mission 18 extends `scripts/check-klyx-backup.ps1` with:

```text
-ExpectedCommit <40-char SHA>
```

The source backup used for DR certification must be successful, belong to the exact certification SHA, have a non-expired artifact, pass SHA-256/archive-integrity checks, and contain the expected Git commit.

## Evidence 2 — Full cloud restore drill

Workflow:

```text
KLYX Supabase Full Restore Drill
```

File:

```text
.github/workflows/klyx-supabase-full-restore-drill.yml
```

The workflow is manual-only, runs only from `main`, requires explicit production-read confirmation, reads production only, restores into a new loopback Supabase lab, and deletes all sensitive runner material.

It proves:

```text
production read-only snapshot
-> isolated db-only Supabase
-> public DB restore
-> Auth DB restore
-> migration-history restore
-> all public-table row-count comparison
-> preserve restored DB
-> full local Auth + Storage stack
-> Storage object restore
-> object re-download SHA-256 verification
-> Auth verification through local GoTrue
-> destroy lab and sensitive snapshot
```

Only a sanitized proof artifact is uploaded.

The workflow never runs `supabase link`, `supabase db push`, production SQL writes, production Storage uploads, or production Auth mutations.

## Evidence 3 — Offsite encrypted archive restore

Existing offsite backups remain encrypted `.klyxdr` archives backed by the Windows/OneDrive DR process.

Mission 18 strengthens:

```text
scripts/test-klyx-supabase-dr-restore.ps1
```

with:

```text
-ExpectedCommit <40-char SHA>
```

The restore drill refuses an archive from another commit.

A successful isolated restore emits:

```text
KLYX_DR_CERTIFICATE_<run>.json
```

The sanitized certificate records only recovery evidence:

- backup Git commit;
- backup creation time;
- encrypted archive SHA-256;
- exact-commit match;
- isolated-local-restore flag;
- public DB verified;
- Auth DB verified;
- Auth service verified;
- Storage binary integrity verified;
- Storage service verified;
- no production write;
- no linked command;
- no retained plaintext;
- restore tested.

It contains no user records, Auth identities, Storage object paths or raw database contents.

Helper:

```text
scripts/prepare-klyx-dr-certification.ps1
```

validates exact commit, evidence age <= 24h, backup age at restore <= 24h RPO target, all recovery booleans, zero production write, zero linked command, and zero retained plaintext.

It outputs only the offsite certificate SHA-256, offsite backup commit, and offsite restore verification timestamp.

## Central certification gate

Workflow:

```text
KLYX Disaster Recovery Certification
```

File:

```text
.github/workflows/klyx-disaster-recovery-certification.yml
```

The operator supplies:

- successful full restore run ID;
- offsite certificate SHA-256;
- offsite backup commit;
- offsite restore timestamp;
- explicit offsite-restore confirmation.

The gate independently verifies through the GitHub Actions API that the full restore run is successful, manual, recent, exact-SHA, and has a valid sanitized artifact.

It also finds a successful `KLYX Source Backup` for the exact SHA, downloads the source backup artifact, validates the archive, and verifies its embedded Git commit.

The offsite certificate metadata must be recent and match the exact SHA.

## Certification result

Only after all gates pass does the workflow emit:

```text
overall=certified
```

and publish commit status:

```text
KLYX Disaster Recovery Certification = success
```

Otherwise the workflow fails and publishes a failed/error status.

The uploaded certification artifact is sanitized and retained for 90 days.

## RPO and evidence freshness

Mission 18 uses the existing DR target:

```text
RPO <= 24 hours
```

Therefore source backup evidence, cloud full-restore evidence, and the offsite restore certificate must each be <= 24h old. The offsite backup restored by the local drill must also have been <= 24h old at restore time.

This is an evidence requirement, not an invented RTO claim. Mission 18 does not claim an RTO that has not been measured.

## Security model

No DR certification workflow uploads SQL dumps, Auth rows, Storage object bytes, service-role keys, DB credentials, encrypted archive passphrases or private row-count files.

Full restore snapshot data is destroyed from the GitHub runner.

The offsite encrypted archive remains outside GitHub.

GitHub receives only sanitized recovery proofs and the SHA-256 of the offsite certificate.

## What Mission 18 does not do

Mission 18 does not write to production during restore drills, activate Stripe LIVE, mutate Vercel, alter financial truth, alter Booking/Settlement state, auto-resolve incidents, or claim DR certification merely because code/tests are green.

## Operational sequence after Mission 18 merge

For the exact current `main` SHA:

1. Wait for successful `KLYX Source Backup`.
2. Run `KLYX Supabase Full Restore Drill` manually with production-read confirmation.
3. Create a fresh encrypted offsite `.klyxdr` backup for the same commit.
4. Run:
   ```powershell
   .\scripts\test-klyx-supabase-dr-restore.ps1 -ExpectedCommit <MAIN_SHA>
   ```
5. Prepare the sanitized offsite evidence:
   ```powershell
   .\scripts\prepare-klyx-dr-certification.ps1 -ExpectedCommit <MAIN_SHA>
   ```
6. Run `KLYX Disaster Recovery Certification` with the full restore run ID and helper outputs.
7. Treat KLYX as DR-certified for that SHA only if the certification workflow succeeds.

A later `main` commit requires a new certification.
