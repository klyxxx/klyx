import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const automaticRunner = fs.readFileSync(
  path.join(root, "scripts/backup-klyx-supabase-dr-auto.ps1"),
  "utf8",
);

const canonicalBackup = fs.readFileSync(
  path.join(root, "scripts/backup-klyx-supabase-dr.ps1"),
  "utf8",
);

const canonicalRestore = fs.readFileSync(
  path.join(root, "scripts/test-klyx-supabase-dr-restore.ps1"),
  "utf8",
);

const retryWrapper = fs.readFileSync(
  path.join(root, "scripts/dr/invoke-supabase-with-retry.ps1"),
  "utf8",
);

const retryShim = fs.readFileSync(
  path.join(root, "scripts/dr/supabase.cmd"),
  "utf8",
);

describe("automatic exact-SHA DR runner", () => {
  it("uses bounded retry for transient Supabase/pooler failures", () => {
    expect(retryWrapper).toContain("server closed the connection unexpectedly");
    expect(retryWrapper).toContain("connection reset");
    expect(retryWrapper).toContain("unexpected eof");
    expect(retryWrapper).toContain("@(0, 5, 30, 120, 300)");
    expect(retryWrapper).toContain("non-transient error; retry refused");
    expect(retryShim).toContain("invoke-supabase-with-retry.ps1");
  });

  it("also hardens the canonical backup path with bounded attempts", () => {
    expect(canonicalBackup).toContain("[int]$MaxAttempts = 4");
    expect(canonicalBackup).toContain("FAILED after $MaxAttempts bounded attempts");
    expect(canonicalBackup).toContain("Retrying in $DelaySeconds seconds");
  });

  it("keeps secrets non-interactive and protected by the existing DPAPI boundary", () => {
    expect(automaticRunner).toContain("database-password.dpapi");
    expect(automaticRunner).toContain("dr-passphrase.dpapi");
    expect(automaticRunner).toContain("Interactive secrets : NO");
    expect(automaticRunner).not.toContain("STRIPE_SECRET_KEY");
    expect(automaticRunner).not.toContain("sk_live_");
  });

  it("never falls back to an archive from another Git SHA", () => {
    expect(automaticRunner).toContain("git rev-parse HEAD");
    expect(automaticRunner).toContain('Filter "klyx-dr-*-$ShortCommit.klyxdr"');
    expect(automaticRunner).toContain("Fresh exact-SHA DR archive missing");
    expect(automaticRunner).toContain("Old archives will not be reused");
    expect(automaticRunner).toContain("-ExpectedCommit $Commit");

    expect(canonicalRestore).toContain("ExpectedCommit must be a full 40-character Git SHA");
    expect(canonicalRestore).toContain('Filter "*-$ExpectedShortCommit.klyxdr"');
    expect(canonicalRestore).toContain("Stale fallback refused");
  });

  it("automatically verifies the isolated restore certificate for the same SHA", () => {
    expect(automaticRunner).toContain("KLYX_DR_CERTIFICATE_*.json");
    expect(automaticRunner).toContain("backupGitCommit");
    expect(automaticRunner).toContain("expectedGitCommit");
    expect(automaticRunner).toContain("exactCommitMatch");
    expect(automaticRunner).toContain("Production write   : NO");
  });
});
