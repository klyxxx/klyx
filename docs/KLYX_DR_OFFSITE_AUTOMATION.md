# KLYX DR — Offsite automation foundation

## Goal

Automate encrypted disaster-recovery backups to an infrastructure provider independent from GitHub and Supabase, while preserving fail-closed recovery semantics.

## Security invariant

The decryption private key must never be stored in GitHub, Dropbox, Supabase or the automated backup runner.

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

## Provider boundary

The offsite transport adapter never decides what production data belongs in a backup. It accepts only a pre-built, encrypted `KLYXDR02` archive.

```text
production snapshot authority
≠
encryption authority
≠
offsite transport authority
≠
recovery private-key authority
```

This separation prevents Dropbox credentials from becoming a production-read authority and prevents the backup runner from becoming a decryption authority.

## Dropbox — first concrete provider

Dropbox is the first bounded provider implementation.

Canonical destination:

```text
/KLYX-DR/<unique-klyx-dr-archive>.klyxdr
```

Required runtime credentials:

```text
KLYX_DR_DROPBOX_APP_KEY
KLYX_DR_DROPBOX_APP_SECRET
KLYX_DR_DROPBOX_REFRESH_TOKEN
```

Use a dedicated Dropbox application with **App Folder** access and only the minimum file read/write metadata scopes required for the KLYX DR folder. The ChatGPT Dropbox connection is useful for operator access, but its OAuth credentials are not reused by the KLYX runtime.

Transport invariants:

- destination is hard-bounded to `/KLYX-DR`;
- archive name must follow the canonical KLYX DR naming convention;
- only `KLYXDR02` archives are accepted by the automated provider;
- Dropbox access tokens are short-lived and refreshed server-side;
- upload uses conflict-safe add semantics, never silent overwrite;
- encrypted archive is downloaded again after upload;
- local SHA-256 must equal read-back SHA-256;
- a `.sha256` sidecar is uploaded and read-back verified;
- only sanitized proof metadata may leave the transport layer;
- no private recovery key is present in Dropbox or GitHub.

Dropbox API upload is bounded to the single-request limit used by the provider. Larger future archives must move to Dropbox upload sessions without weakening the same integrity checks.

## External provider contract

Any future provider must remain outside both GitHub and Supabase failure domains and satisfy:

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

The recovery format remains provider-agnostic. Dropbox is the first adapter, not a permanent platform lock-in.

## Failure policy

```text
automated Dropbox offsite backup
→ bounded retry
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

The Dropbox adapter alone does not certify DR. The uploaded archive still has to be restored successfully with the independent private key before the central certification gate may pass.

This foundation does not activate Stripe LIVE, move money, or write to Supabase production.
