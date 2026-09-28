import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const scope = source("CERTIFICATION_ALL_PROVIDERS.md");
const finalReport = source("scripts/certification/klyx-all-providers-final-report.mjs");

describe("KLYX final provider certification report contract", () => {
  it("requires PASS/FAIL reporting by engine, provider and native platform", () => {
    expect(scope).toContain("KLYX All Providers Certification");
    expect(scope).toContain("Provider outages");
    expect(scope).toContain("Android native");
    expect(scope).toContain("iOS native");
    expect(finalReport).toContain("KLYX_EXACT_MOBILE_OUTCOME");
    expect(finalReport).toContain('name: "Android native"');
    expect(finalReport).toContain('name: "iOS native"');
    expect(finalReport).not.toContain('status: "NOT_IMPLEMENTED"');
    expect(finalReport).toContain("...report.platforms.filter((item) => item.status === \"FAIL\")");
  });
});
