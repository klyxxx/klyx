import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

const fullRestore = fs.readFileSync(
  path.join(root, ".github/workflows/klyx-supabase-full-restore-drill.yml"),
  "utf8"
);
const certification = fs.readFileSync(
  path.join(root, ".github/workflows/klyx-disaster-recovery-certification.yml"),
  "utf8"
);
const storageBackup = fs.readFileSync(
  path.join(root, "scripts/backup-klyx-storage.mjs"),
  "utf8"
);
const sourceCheck = fs.readFileSync(
  path.join(root, "scripts/check-klyx-backup.ps1"),
  "utf8"
);
const offsiteRestore = fs.readFileSync(
  path.join(root, "scripts/test-klyx-supabase-dr-restore.ps1"),
  "utf8"
);
const offsitePrepare = fs.readFileSync(
  path.join(root, "scripts/prepare-klyx-dr-certification.ps1"),
  "utf8"
);
const doc = fs.readFileSync(
  path.join(root, "docs/KLYX_DISASTER_RECOVERY_CERTIFICATION.md"),
  "utf8"
);

describe("Mission 18 disaster recovery certification contract", () => {
  it("keeps the full production restore drill manual-only and main-only", () => {
    expect(fullRestore).toContain("workflow_dispatch:");
    expect(fullRestore).not.toContain("pull_request:");
    expect(fullRestore).not.toContain("push:");
    expect(fullRestore).not.toContain("schedule:");
    expect(fullRestore).toContain("github.ref == 'refs/heads/main'");
    expect(fullRestore).toContain("confirm_production_read");
    expect(fullRestore).toContain(
      'if [ "$CONFIRM_PRODUCTION_READ" != "true" ]'
    );
  });

  it("restores public DB, Auth and Storage only into an isolated local target", () => {
    expect(fullRestore).toContain("--schema public");
    expect(fullRestore).toContain("--schema auth");
    expect(fullRestore).toContain("--schema supabase_migrations");
    expect(fullRestore).toContain("db start");
    expect(fullRestore).toContain(
      'node scripts/restore-klyx-storage.mjs "$KLYX_FULL_DR_STORAGE_ROOT"'
    );
    expect(fullRestore).toContain("all_public_table_row_counts_match=true");
    expect(fullRestore).toContain("auth_service_verified=true");
    expect(fullRestore).toContain("storage_binary_sha256_verified=true");
    expect(fullRestore).toContain("storage_service_verified=true");
  });

  it("preserves the restored database before starting the full local stack", () => {
    const restartSection = fullRestore.slice(
      fullRestore.indexOf(
        "- name: Restart isolated lab with Auth and Storage services"
      ),
      fullRestore.indexOf(
        "- name: Restore and verify Storage plus Auth service"
      )
    );

    expect(restartSection).toContain(
      'supabase --workdir "$KLYX_FULL_DR_LAB_ROOT" stop'
    );
    expect(restartSection).not.toContain("stop --no-backup");
    expect(fullRestore).toContain(
      'supabase --workdir "$KLYX_FULL_DR_LAB_ROOT" stop --no-backup || true'
    );
  });

  it("never uploads production snapshot material", () => {
    const uploadSection = fullRestore.slice(
      fullRestore.indexOf("- name: Upload sanitized full recovery proof"),
      fullRestore.indexOf("- name: Destroy sensitive recovery material")
    );

    expect(uploadSection).toContain("full-restore-proof/");
    expect(uploadSection).not.toContain("KLYX_FULL_DR_DB_ROOT");
    expect(uploadSection).not.toContain("KLYX_FULL_DR_STORAGE_ROOT");
    expect(uploadSection).not.toContain("public-data.sql");
    expect(uploadSection).not.toContain("auth-data.sql");
    expect(fullRestore).toContain("sensitive_snapshot_uploaded=false");
    expect(fullRestore).toContain('rm -rf -- "$KLYX_FULL_DR_WORK_ROOT"');
  });

  it("uses explicit production source credentials without breaking local backup fallback", () => {
    expect(storageBackup).toContain(
      "process.env.KLYX_DR_SOURCE_SUPABASE_URL"
    );
    expect(storageBackup).toContain(
      "process.env.KLYX_DR_SOURCE_SERVICE_ROLE_KEY"
    );
    expect(storageBackup).toContain("env.NEXT_PUBLIC_SUPABASE_URL");
    expect(storageBackup).toContain("env.SUPABASE_SERVICE_ROLE_KEY");
  });

  it("binds source and offsite restore evidence to an exact Git commit", () => {
    expect(sourceCheck).toContain('[string]$ExpectedCommit = ""');
    expect(sourceCheck).toContain("Source backup commit mismatch");
    expect(offsiteRestore).toContain('[string]$ExpectedCommit = ""');
    expect(offsiteRestore).toContain("KLYX DR backup commit mismatch");
    expect(offsiteRestore).toContain("backupGitCommit");
    expect(offsiteRestore).toContain("exactCommitMatch");
  });

  it("emits a sanitized offsite certificate and validates its RPO freshness", () => {
    expect(offsiteRestore).toContain(
      "KLYX_DISASTER_RECOVERY_OFFSITE_CERTIFICATE"
    );
    expect(offsiteRestore).toContain("storageBinaryIntegrity");
    expect(offsiteRestore).toContain("authServiceVerified");
    expect(offsiteRestore).toContain("plaintextRetained");
    expect(offsitePrepare).toContain("MaxEvidenceAgeHours = 24");
    expect(offsitePrepare).toContain(
      "backup did not meet the 24h RPO target"
    );
    expect(offsitePrepare).toContain("Get-FileHash");
    expect(offsitePrepare).toContain("[Convert]::ToBase64String");
    expect(offsitePrepare).toContain("offsite_certificate_base64=");
    expect(offsitePrepare).toContain("offsite_certificate_sha256=");
  });

  it("requires source, cloud restore and offsite evidence for one exact main SHA", () => {
    expect(certification).toContain(
      "KLYX Disaster Recovery Certification"
    );
    expect(certification).toContain("github.ref == 'refs/heads/main'");
    expect(certification).toContain(
      "KLYX Supabase Full Restore Drill"
    );
    expect(certification).toContain("KLYX Source Backup");
    expect(certification).toContain(
      'if [ "$normalized_commit" != "$expected_commit" ]'
    );
    expect(certification).toContain(
      'grep -Fx "commit=${GITHUB_SHA}"'
    );
    expect(certification).toContain(
      '-ExpectedCommit "$GITHUB_SHA"'
    );
    expect(certification).toContain("offsite_certificate_base64");
    expect(certification).toContain(
      'certificate.format !== "KLYX_DISASTER_RECOVERY_OFFSITE_CERTIFICATE"'
    );
    expect(certification).toContain(
      "Unexpected field in sanitized offsite certificate"
    );
    expect(certification).toContain(
      "backupCommit !== expectedCommit"
    );
    expect(certification).toContain(
      "certificate.productionWrite !== false"
    );
    expect(certification).toContain(
      "certificate.plaintextRetained !== false"
    );
    expect(certification).toContain(
      'normalized_hash="$(sha256sum "$certificate_file"'
    );
    expect(certification).toContain("overall=certified");
  });

  it("fails closed on stale evidence and publishes a commit status", () => {
    expect(certification).toContain("must be no older than 24 hours");
    expect(certification).toContain(
      "Offsite DR backup did not meet the 24h RPO target at restore time."
    );
    expect(certification).toContain("statuses: write");
    expect(certification).toContain('state="failure"');
    expect(certification).toContain('state="success"');
  });

  it("does not claim that merging the mission itself certifies production DR", () => {
    expect(doc).toContain(
      "It does **not** by itself mean that production disaster recovery is certified."
    );
    expect(doc).toContain("NOT CERTIFIED");
    expect(doc).toContain(
      "A later `main` commit requires a new certification."
    );
    expect(doc).toContain("offsite_certificate_base64");
    expect(doc).toContain(
      "GitHub decodes the sanitized offsite certificate itself"
    );
  });

  it("keeps recovery drills free of production mutation commands", () => {
    for (const forbidden of [
      "supabase link",
      "supabase db push",
      "stripe.transfers.create(",
      "stripe.refunds.create(",
    ]) {
      expect(fullRestore).not.toContain(forbidden);
    }

    expect(doc).toContain("write to production during restore drills");
  });
});
