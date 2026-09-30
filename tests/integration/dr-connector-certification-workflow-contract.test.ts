import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const workflow = fs.readFileSync(
  path.join(root, ".github/workflows/klyx-disaster-recovery-connector-certification.yml"),
  "utf8"
);

describe("KLYX connector DR certification contract", () => {
  it("only accepts owner-opened explicit certification issues", () => {
    expect(workflow).toContain("issues:");
    expect(workflow).toContain("github.event.issue.user.login == github.repository_owner");
    expect(workflow).toContain("[KLYX-DR-CONNECTOR-CERT]");
  });

  it("is exact-main and fail-closed", () => {
    expect(workflow).toContain("Connector certification refuses stale main.");
    expect(workflow).toContain("targetSha");
    expect(workflow).toContain("productionWrite");
    expect(workflow).toContain("plaintextRetained");
    expect(workflow).toContain("privateRecoveryKeyInGitHub");
  });

  it("requires verified independent Dropbox and Google Drive evidence", () => {
    expect(workflow).toContain('k.provider !== "google_drive"');
    expect(workflow).toContain("d.uploadVerified !== true");
    expect(workflow).toContain("d.contentHashVerified !== true");
    expect(workflow).toContain("k.keyPairSelfTestVerified !== true");
  });

  it("re-verifies source backup, full restore and encrypted handoff", () => {
    expect(workflow).toContain("Verify exact-main full cloud restore");
    expect(workflow).toContain("Verify encrypted exact-SHA handoff artifact");
    expect(workflow).toContain("Verify exact-main source backup");
    expect(workflow).toContain("KLYX_DR_CONNECTOR_HANDOFF_PROOF");
    expect(workflow).toContain("KLYXDR02");
    expect(workflow).toContain("check-klyx-backup.ps1");
  });

  it("publishes an auditable certification without touching Stripe LIVE", () => {
    expect(workflow).toContain("KLYX Connector DR Certification");
    expect(workflow).toContain("overall=certified");
    expect(workflow).toContain("private_recovery_key_in_github=false");
    expect(workflow).toContain("Stripe LIVE was not touched");
    expect(workflow).not.toContain("stripe transfer");
    expect(workflow).not.toContain("stripe payment_intent");
  });
});
