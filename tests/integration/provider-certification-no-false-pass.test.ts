import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const workflow = fs.readFileSync(
  path.join(process.cwd(), ".github/workflows/klyx-all-providers-certification.yml"),
  "utf8"
);

describe("KLYX no-false-PASS contract", () => {
  it("may collect gate failures but always enforces the aggregate verdict fail-closed", () => {
    const report = workflow.indexOf("Produce final PASS FAIL report");
    const enforce = workflow.indexOf("Enforce certification verdict");

    expect(workflow).toContain("continue-on-error: true");
    expect(report).toBeGreaterThanOrEqual(0);
    expect(enforce).toBeGreaterThan(report);
    expect(workflow).toContain("steps.final_report.outcome");
    expect(workflow).toContain("KLYX all-provider certification report contains one or more FAIL results.");
  });
});
