# KLYX DR — GitHub-driven automation

## Goal

Remove routine operator shell steps from disaster-recovery certification while preserving the existing exact-SHA and fail-closed invariants.

## Canonical chain

```text
exact main SHA
→ Source Backup
→ Full Restore Drill
→ encrypted KLYXDR02 offsite backup
→ independent recovery authority
→ offsite restore certificate
→ central DR certification
```

## Security boundary

GitHub may orchestrate the chain and hold sanitized proof metadata.

GitHub must never receive the DR private recovery key.

The automated backup path may use only the existing public-key envelope:

```text
AES-256-GCM
+
RSA-OAEP-SHA256
```

The private key remains with an independent recovery authority. Dropbox remains transport/storage only and must never become a decryption authority.

## Exact-SHA rule

Every stage must bind to the same 40-character Git SHA. If `main` advances during the chain, the chain fails closed and a new certification cycle is required.

## Production safety

DR workflows are read-only against production. They must not:

- link an isolated restore lab to production;
- push migrations;
- modify production rows;
- create Stripe Transfers or Refunds;
- enable Stripe LIVE;
- upload plaintext snapshots as GitHub artifacts.

## Operator policy

Routine backup and certification orchestration should be automated. Human intervention is reserved for recovery-authority failures or cases where state cannot be proven automatically.
