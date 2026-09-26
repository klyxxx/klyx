# KLYX DR — Offsite automation foundation

## Goal

Automate encrypted disaster-recovery backups to an infrastructure provider independent from GitHub and Supabase, while preserving fail-closed recovery semantics.

## Security invariant

The decryption private key must never be stored in GitHub.

The automated backup path uses a public-key envelope:

```text
snapshot
→ deterministic recovery payload
→ random AES-256-GCM data key
→ data key wrapped with RSA-OAEP-SHA256 public key
→ KLYXDR02 encrypted archive
→ independent offsite provider
```

GitHub may hold only the public encryption key. Recovery requires the corresponding private key from an independent recovery authority.

## Archive compatibility

`KLYXDR01` remains supported for existing passphrase-encrypted archives.

`KLYXDR02` adds public-key envelope encryption:

```text
RSA-OAEP-SHA256
+
AES-256-GCM
```

The decryptor auto-detects the archive generation and fails closed when the required recovery authority is unavailable.

## External provider contract

The offsite provider must be outside both GitHub and Supabase failure domains.

Required properties:

- encrypted object storage;
- HTTPS transport;
- independent credentials;
- unique immutable/versioned object keys;
- retention >= 30 days;
- at least three recoverable copies over the retention window;
- no production mutation permission;
- read-back verification after upload;
- no decryption private key in the backup runner;
- audit proof containing only sanitized metadata and hashes.

The provider adapter must not be hard-coded to one country or one vendor. An S3-compatible adapter is the preferred first implementation because it can target multiple independent storage vendors without changing the KLYX recovery format.

## Failure policy

```text
automated independent offsite backup
→ retry with bounded backoff
→ secondary independent provider/local OneDrive fallback
→ human_review only if every automated path fails
```

A failed or missing offsite backup must never be treated as a successful DR certification.

## Certification

The existing central DR gate remains authoritative:

```text
source backup exact SHA
+
full cloud restore exact SHA
+
offsite encrypted restore exact SHA
=
DR certified exact SHA
```

This foundation does not itself certify DR, activate Stripe LIVE, move money, or write to Supabase production.
