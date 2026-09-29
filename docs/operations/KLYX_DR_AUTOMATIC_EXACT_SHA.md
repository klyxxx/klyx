# KLYX automatic exact-SHA DR

The Windows DR scheduled runner is `scripts/backup-klyx-supabase-dr-auto.ps1`.

It is fail-closed and non-interactive once the existing Windows DPAPI secrets are provisioned:

```text
current main SHA
→ encrypted DB/Auth/Storage backup
→ bounded retry for transient Supabase/pooler failures
→ OneDrive offsite SHA-256 verification
→ fresh archive selection restricted to the current SHA
→ isolated local restore
→ exact-SHA DR certificate verification
```

A failed backup never falls back to an older archive. Authentication/configuration errors are not retried. Only transient network/pooler errors use bounded backoff.

The runner may start Docker Desktop and OneDrive when available. It does not write to Supabase production during restore, activate Stripe LIVE, or mutate financial state.

The central `KLYX Disaster Recovery Certification` remains authoritative for final DR certification of a specific `main` SHA.
