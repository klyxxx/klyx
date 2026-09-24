import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "lib/resilience-engine.ts"),
  "utf8"
);

describe("KLYX resilience fail-closed source contract", () => {
  it("fences expired claims before execution and failure acknowledgement", () => {
    expect(source).toContain("STALE_CLAIM_EXECUTION");
    expect(source).toContain("STALE_CLAIM_FAILURE:");
    expect(source).toContain("job.lease.expiresAtMs <= this.clock.nowMs()");
  });

  it("treats executor throws as ambiguous external state", () => {
    expect(source).toContain("EXECUTOR_THROW_UNKNOWN_STATE");
    expect(source).not.toContain(
      'result = { kind: "retryable_failure", errorCode: "EXECUTOR_THROW" }'
    );
  });
});
