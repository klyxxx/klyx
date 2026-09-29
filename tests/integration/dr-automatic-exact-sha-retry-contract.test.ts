import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const automaticRunner = fs.readFileSync(
  path.join(root, "scripts/backup-klyx-supabase-dr-auto.ps1"),
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

  it("keeps secrets non-interactive and protected by the existing DPAPI boundary", () => {
    expect(automaticRunner).toContain("database-password.dpapi");
    expect(automaticRunner).toContain("dr-passphrase.dpapi");
    expect(automaticRunner).toContain("Interactive secrets : NO");
    expect(automaticRunner).not.toContain("STRIPE_SECRET_KEY");
    expect(automaticRunner).not.toContain("sk_live_");
  });

  it("never falls back to an archive from another Git SHA", () => {
    expect(automaticRunner).toContain('git rev-parse HEAD');
    expect(automaticRunner).toContain('Filter "klyx-dr-*-$ShortCommit.klyxdr"');
    expect(automaticRunner).toContain("Fresh exact-SHA DR archive missing");
    expect(automaticRunner).toContain("Old archives will not be reused");
    expect(automaticRunner).toContain("-ExpectedCommit $Commit");
  });

  it("automatically verifies the isolated restore certificate for the same SHA", () => {
    expect(automaticRunner).toContain("KLYX_DR_CERTIFICATE_*.json");
    expect(automaticRunner).toContain("backupGitCommit");
    expect(automaticRunner).toContain("expectedGitCommit");
    expect(automaticRunner).toContain("exactCommitMatch");
    expect(automaticRunner).toContain("Production write   : NO");
  });
});
