import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workflow = fs
  .readFileSync(
    path.join(
      root,
      ".github/workflows/klyx-settlement-recovery-certification-dispatch.yml"
    ),
    "utf8"
  )
  .replace(/\r\n/g, "\n");

describe("Mission 19 exact-SHA dispatcher serialization", () => {
  it("waits for the workflow concurrency queue before dispatching each gate", () => {
    expect(workflow).toContain("wait_workflow_idle()");
    expect(workflow).toContain(
      'select(.status == "queued" or .status == "in_progress" or .status == "pending" or .status == "waiting" or .status == "requested")'
    );
    expect(workflow).toContain('wait_workflow_idle "$workflow"');
  });

  it("captures previous exact-SHA run ids before creating a new run", () => {
    expect(workflow).toContain('before_file="$(mktemp)"');
    expect(workflow).toContain('--commit "$GITHUB_SHA"');
    expect(workflow).toContain('--event workflow_dispatch');
    expect(workflow).toContain('! grep -Fxq "$candidate" "$before_file"');
  });

  it("pins every dispatched gate to the immutable candidate SHA", () => {
    expect(workflow).toContain('-f expected_sha="$GITHUB_SHA"');
    expect(workflow).toContain(
      'Recovery dispatcher checkout SHA mismatch: expected $GITHUB_SHA'
    );
  });

  it("awaits each newly-created run before dispatching the next gate", () => {
    expect(workflow).toContain(
      'gh run watch "$run_id" --repo "$GH_REPO" --exit-status'
    );

    const security = workflow.indexOf(
      "dispatch_and_wait klyx-security.yml"
    );
    const golden = workflow.indexOf(
      "dispatch_and_wait \\\n            klyx-golden-path.yml"
    );
    const performance = workflow.indexOf(
      "dispatch_and_wait \\\n            klyx-performance.yml"
    );
    const e2e = workflow.indexOf(
      "dispatch_and_wait klyx-e2e.yml"
    );
    const stripe = workflow.indexOf(
      "dispatch_and_wait \\\n            klyx-stripe-network-test.yml"
    );

    expect(security).toBeGreaterThan(-1);
    expect(golden).toBeGreaterThan(security);
    expect(performance).toBeGreaterThan(golden);
    expect(e2e).toBeGreaterThan(performance);
    expect(stripe).toBeGreaterThan(e2e);
  });

  it("does not use the former fan-out-then-watch workflow array", () => {
    expect(workflow).not.toContain("workflows=(");
  });
});
