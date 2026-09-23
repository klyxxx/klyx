import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const dispatcher = fs.readFileSync(
  path.join(root, ".github/workflows/klyx-full-restore-request-dispatcher.yml"),
  "utf8"
);
const fullRestore = fs.readFileSync(
  path.join(root, ".github/workflows/klyx-supabase-full-restore-drill.yml"),
  "utf8"
);
const request = JSON.parse(
  fs.readFileSync(
    path.join(root, ".github/dr/full-restore-request.json"),
    "utf8"
  )
) as Record<string, unknown>;

describe("KLYX audited full restore request dispatcher", () => {
  it("keeps the destructive-evidence workflow manual-only", () => {
    expect(fullRestore).toContain("workflow_dispatch:");
    expect(fullRestore).not.toContain("push:");
    expect(fullRestore).not.toContain("pull_request:");
    expect(fullRestore).toContain("confirm_production_read");
  });

  it("triggers only from an explicit versioned request merged to main", () => {
    expect(dispatcher).toContain("push:");
    expect(dispatcher).toContain("branches:\n      - main");
    expect(dispatcher).toContain(
      "- .github/dr/full-restore-request.json"
    );
    expect(dispatcher).toContain(
      "github.ref == 'refs/heads/main'"
    );
    expect(request.format).toBe("KLYX_FULL_RESTORE_REQUEST");
    expect(request.version).toBe(1);
    expect(request.confirmProductionRead).toBe(true);
    expect(String(request.baseMainSha)).toMatch(/^[a-f0-9]{40}$/);
  });

  it("binds the request to the previous exact main and refuses stale dispatch", () => {
    expect(dispatcher).toContain("git rev-parse HEAD^1");
    expect(dispatcher).toContain(
      "baseMainSha does not match this main commit parent"
    );
    expect(dispatcher).toContain(
      'git/ref/heads/main'
    );
    expect(dispatcher).toContain(
      "main advanced after this DR request commit; refusing stale dispatch"
    );
  });

  it("dispatches the existing protected workflow with explicit production-read confirmation", () => {
    expect(dispatcher).toContain(
      "gh workflow run klyx-supabase-full-restore-drill.yml"
    );
    expect(dispatcher).toContain("--ref main");
    expect(dispatcher).toContain("-f confirm_production_read=true");
  });

  it("requires the created workflow_dispatch run to match the request commit exactly", () => {
    expect(dispatcher).toContain(
      '.head_sha == \\"${GITHUB_SHA}\\"'
    );
    expect(dispatcher).toContain(
      '[ "$head_sha" != "$GITHUB_SHA" ]'
    );
    expect(dispatcher).toContain(
      '[ "$head_branch" != "main" ]'
    );
    expect(dispatcher).toContain(
      '[ "$event" != "workflow_dispatch" ]'
    );
  });

  it("has no direct production database or Stripe mutation authority", () => {
    for (const forbidden of [
      "supabase db push",
      "supabase link",
      "stripe.transfers.create(",
      "stripe.refunds.create(",
      "stripe.checkout.sessions.create(",
    ]) {
      expect(dispatcher).not.toContain(forbidden);
    }

    expect(dispatcher).toContain("actions: write");
    expect(dispatcher).toContain("contents: read");
  });
});
