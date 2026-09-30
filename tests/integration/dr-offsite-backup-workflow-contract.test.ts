import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const workflow = fs.readFileSync(
  path.join(root, ".github/workflows/klyx-dr-offsite-backup.yml"),
  "utf8"
);
const dispatcher = fs.readFileSync(
  path.join(root, ".github/workflows/klyx-full-restore-request-dispatcher.yml"),
  "utf8"
);
const uploader = fs.readFileSync(
  path.join(root, "scripts/dr/upload-dropbox-offsite.mjs"),
  "utf8"
);

describe("KLYX automated offsite DR backup contract", () => {
  it("runs only after a successful full restore or explicit dispatch", () => {
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain('"KLYX Supabase Full Restore Drill"');
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("target_sha:");
    expect(workflow).toContain("inputs.target_sha");
  });

  it("explicitly chains exact-main full restore success to offsite backup", () => {
    expect(dispatcher).toContain("Wait for exact-main full restore success");
    expect(dispatcher).toContain("Refuse stale main before offsite dispatch");
    expect(dispatcher).toContain("gh workflow run klyx-dr-offsite-backup.yml");
    expect(dispatcher).toContain('-f target_sha="$GITHUB_SHA"');
    expect(dispatcher).toContain("Wait for exact-main offsite backup success");
  });

  it("refuses stale main and keeps production access read-only", () => {
    expect(workflow).toContain("Offsite backup refuses stale main.");
    expect(workflow).toContain("supabase db dump");
    expect(workflow).not.toContain("supabase db push");
    expect(workflow).not.toContain("supabase migration up");
    expect(workflow).not.toContain("stripe");
  });

  it("fails early when external recovery authority is not provisioned", () => {
    expect(workflow).toContain("Preflight exact SHA and external backup authority");
    expect(workflow).toContain("Missing required GitHub Actions secret");
    expect(workflow.indexOf("Preflight exact SHA and external backup authority")).toBeLessThan(
      workflow.indexOf("Install locked dependencies")
    );
  });

  it("retries transient Supabase dump failures without accepting partial files", () => {
    expect(workflow).toContain("Capture production logical database snapshot with bounded retry");
    expect(workflow).toContain("dump_with_retry()");
    expect(workflow).toContain("local max_attempts=4");
    expect(workflow).toContain("local delays=(5 15 30)");
    expect(workflow).toContain('rm -f -- "$output"');
    expect(workflow).toContain("failed after ${max_attempts} attempts");
  });

  it("binds the encrypted archive to the exact certified SHA", () => {
    expect(workflow).toContain('checkout_sha="$(git rev-parse HEAD)"');
    expect(workflow).toContain("Checkout SHA drifted before archive creation.");
    expect(workflow).toContain('"gitCommit": "${KLYX_TARGET_SHA}"');
    expect(workflow).toContain("Encrypted archive name is not bound to the expected SHA.");
  });

  it("uses KLYXDR02 public-key encryption without private recovery authority", () => {
    expect(workflow).toContain("KLYX_DR_PUBLIC_KEY_PEM");
    expect(workflow).toContain("scripts/encrypt-klyx-dr-envelope.mjs");
    expect(workflow).toContain('!= "KLYXDR02"');
    expect(workflow).not.toContain("KLYX_DR_PRIVATE_KEY");
    expect(workflow).not.toContain("PRIVATE KEY");
  });

  it("uploads only encrypted data to Dropbox and emits sanitized proof", () => {
    expect(workflow).toContain("scripts/dr/upload-dropbox-offsite.mjs");
    expect(workflow).toContain("KLYX_DR_DROPBOX_APP_KEY");
    expect(workflow).toContain("KLYX_DR_DROPBOX_APP_SECRET");
    expect(workflow).toContain("KLYX_DR_DROPBOX_REFRESH_TOKEN");
    expect(workflow).toContain("klyx-dr-offsite-backup-proof-");
    expect(workflow).not.toContain("path: ${{ env.KLYX_OFFSITE_ENCRYPTED_ARCHIVE }}");
    expect(uploader).toContain("KLYX_DR_OFFSITE_BACKUP_PROOF");
    expect(uploader).toContain("readBackVerified");
    expect(uploader).toContain("plaintextUploaded: false");
    expect(uploader).toContain("privateRecoveryKeyPresent: false");
  });

  it("destroys runner-side sensitive material even on failure", () => {
    expect(workflow).toContain("Destroy sensitive offsite backup material");
    expect(workflow).toContain("if: always()");
    expect(workflow).toContain('rm -rf -- "$KLYX_OFFSITE_WORK_ROOT"');
  });
});
