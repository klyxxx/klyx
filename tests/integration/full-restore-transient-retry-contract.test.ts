import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const workflow = fs.readFileSync(
  path.join(root, ".github/workflows/klyx-full-restore-transient-retry.yml"),
  "utf8"
);

describe("KLYX Full Restore transient retry controller", () => {
  it("listens only to completed Full Restore Drill runs", () => {
    expect(workflow).toContain('"KLYX Supabase Full Restore Drill"');
    expect(workflow).toContain("types:\n      - completed");
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'failure'");
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'");
  });

  it("is bounded and refuses stale main", () => {
    expect(workflow).toContain('if [ "$FAILED_RUN_ATTEMPT" -ge 3 ]');
    expect(workflow).toContain("retry budget exhausted");
    expect(workflow).toContain("main advanced before retry; refusing stale rerun");
    expect(workflow).toContain("git/ref/heads/main");
  });

  it("reruns only failures proven transient from GitHub logs", () => {
    expect(workflow).toContain("Prove failure is transient");
    expect(workflow).toContain("server closed the connection unexpectedly");
    expect(workflow).toContain("Failure is not classified as transient; refusing automatic rerun.");
    expect(workflow).toContain("steps.classify.outputs.transient == 'true'");
    expect(workflow).toContain("/rerun");
  });

  it("cannot mutate production or activate payments", () => {
    expect(workflow).not.toContain("supabase db push");
    expect(workflow).not.toContain("supabase migration up");
    expect(workflow).not.toContain("stripe");
    expect(workflow).not.toContain("SUPABASE_DB_URL");
  });
});
