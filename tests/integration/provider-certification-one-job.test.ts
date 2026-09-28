import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const workflow = fs.readFileSync(
  path.join(process.cwd(), ".github/workflows/klyx-all-providers-certification.yml"),
  "utf8"
);

describe("provider certification single failure domain", () => {
  it("uses one aggregate certification job with a fail-closed final verdict", () => {
    expect(workflow).toMatch(/\njobs:\n  certify:\n/);
    expect(workflow).toContain("name: Providers + recovery + Web Android iOS");
    expect(workflow).toContain("Enforce certification verdict");
    expect(workflow).toContain("steps.final_report.outcome");
  });
});
