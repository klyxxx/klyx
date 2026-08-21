import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function repoPath(file: string) {
  return path.join(process.cwd(), file);
}

function readRepoFile(file: string) {
  return fs.readFileSync(repoPath(file), "utf8").replace(/\r\n/g, "\n");
}

const workflow = readRepoFile(
  ".github/workflows/klyx-golden-main-status.yml"
);
const publisher = readRepoFile("scripts/golden-path-main-status.mjs");
const goldenWorkflow = readRepoFile(".github/workflows/klyx-golden-path.yml");

describe("KLYX automatic main Golden status", () => {
  it("keeps the status publisher syntactically valid", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ["--check", repoPath("scripts/golden-path-main-status.mjs")],
        { stdio: "pipe" }
      )
    ).not.toThrow();
  });

  it("observes only KLYX Golden Path workflow-run lifecycle events", () => {
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain("- KLYX Golden Path");
    expect(workflow).toContain("- requested");
    expect(workflow).toContain("- completed");
    expect(workflow).not.toContain("workflow_dispatch:");
    expect(workflow).not.toContain("pull_request:");
  });

  it("publishes only for automatic pushes of protected main", () => {
    expect(workflow).toContain(
      "github.event.workflow_run.event == 'push'"
    );
    expect(workflow).toContain(
      "github.event.workflow_run.head_branch == 'main'"
    );
    expect(workflow).toContain("ref: main");
    expect(workflow).toContain("persist-credentials: false");
  });

  it("grants only read-content and commit-status write permissions", () => {
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("statuses: write");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).not.toContain("actions: write");
    expect(workflow).not.toContain("pull-requests: write");
  });

  it("publishes pending then terminal state for the exact Golden run SHA", () => {
    expect(workflow).toContain("WORKFLOW_ACTION");
    expect(workflow).toContain('echo "value=requested"');
    expect(workflow).toContain('echo "value=completed:${conclusion}"');
    expect(workflow).toContain(
      "KLYX_GOLDEN_HEAD_SHA: ${{ github.event.workflow_run.head_sha }}"
    );
    expect(workflow).toContain(
      "KLYX_GOLDEN_RUN_ID: ${{ github.event.workflow_run.id }}"
    );
    expect(workflow).toContain("node scripts/golden-path-main-status.mjs");
  });

  it("uses the GitHub token only for a standard commit status", () => {
    expect(publisher).toContain('context: "KLYX Golden Path main proof"');
    expect(publisher).toContain("/statuses/${sha}");
    expect(publisher).toContain("/actions/runs/${runId}");
    expect(publisher).toContain('apiUrl !== "https://api.github.com"');
    expect(publisher).toContain('serverUrl !== "https://github.com"');
    expect(publisher).not.toContain("secrets.");
    expect(publisher).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(publisher).not.toContain("STRIPE_SECRET_KEY");
  });

  it("causes the existing Golden path filter to run on the publisher change", () => {
    expect(goldenWorkflow).toContain('"scripts/golden-path-*.mjs"');
    expect(path.basename("scripts/golden-path-main-status.mjs")).toMatch(
      /^golden-path-.*\.mjs$/
    );
  });
});
