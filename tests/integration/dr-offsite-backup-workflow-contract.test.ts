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
const publicKey = fs.readFileSync(
  path.join(root, "config/dr/klyx-dr-recovery-public.pub"),
  "utf8"
);

describe("KLYX automated offsite DR handoff contract", () => {
  it("runs only after a successful full restore or explicit exact-SHA dispatch", () => {
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain('"KLYX Supabase Full Restore Drill"');
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("target_sha:");
    expect(workflow).toContain("inputs.target_sha");
  });

  it("preserves the existing exact-main dispatcher chain", () => {
    expect(dispatcher).toContain("Wait for exact-main full restore success");
    expect(dispatcher).toContain("Refuse stale main before offsite dispatch");
    expect(dispatcher).toContain("gh workflow run klyx-dr-offsite-backup.yml");
    expect(dispatcher).toContain('-f target_sha="$GITHUB_SHA"');
    expect(dispatcher).toContain("Wait for exact-main offsite backup success");
  });

  it("refuses stale main and never writes to production", () => {
    expect(workflow).toContain("Offsite handoff refuses stale main.");
    expect(workflow).toContain("supabase db dump");
    expect(workflow).not.toContain("supabase db push");
    expect(workflow).not.toContain("supabase migration up");
    expect(workflow).not.toContain("stripe");
  });

  it("retries transient Supabase dump failures and refuses partial output", () => {
    expect(workflow).toContain("Capture production logical database snapshot with bounded retry");
    expect(workflow).toContain("dump_with_retry()");
    expect(workflow).toContain("local max_attempts=4");
    expect(workflow).toContain("local delays=(5 15 30)");
    expect(workflow).toContain('rm -f -- "$output"');
    expect(workflow).toContain("failed after ${max_attempts} attempts");
  });

  it("uses a committed public key and never exposes private recovery authority", () => {
    expect(publicKey).toContain("-----BEGIN PUBLIC KEY-----");
    expect(publicKey).toContain("-----END PUBLIC KEY-----");
    expect(workflow).toContain("config/dr/klyx-dr-recovery-public.pub");
    expect(workflow).toContain("scripts/encrypt-klyx-dr-envelope.mjs");
    expect(workflow).not.toContain("KLYX_DR_PRIVATE_KEY");
    expect(workflow).not.toContain("BEGIN PRIVATE KEY");
  });

  it("binds ciphertext to the exact certified SHA", () => {
    expect(workflow).toContain('checkout_sha="$(git rev-parse HEAD)"');
    expect(workflow).toContain("Checkout SHA drifted before archive creation.");
    expect(workflow).toContain('"gitCommit": "${KLYX_TARGET_SHA}"');
    expect(workflow).toContain("Encrypted archive name is not bound to the expected SHA.");
    expect(workflow).toContain("KLYXDR02");
    expect(workflow).toContain("archiveSha256");
  });

  it("uploads only encrypted handoff material to GitHub Actions", () => {
    expect(workflow).toContain("KLYX_DR_CONNECTOR_HANDOFF_PROOF");
    expect(workflow).toContain("klyx-dr-connector-handoff-");
    expect(workflow).toContain("plaintextUploaded");
    expect(workflow).toContain("privateRecoveryKeyPresent");
    expect(workflow).toContain("retention-days: 3");
    expect(workflow).not.toContain("KLYX_DR_DROPBOX_APP_SECRET");
    expect(workflow).not.toContain("KLYX_DR_DROPBOX_REFRESH_TOKEN");
  });

  it("destroys plaintext and sensitive runner material", () => {
    expect(workflow).toContain('rm -f -- "$plain_archive"');
    expect(workflow).toContain("Destroy sensitive runner material");
    expect(workflow).toContain("if: always()");
    expect(workflow).toContain('rm -rf -- "$KLYX_OFFSITE_WORK_ROOT"');
  });
});
