import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("all-provider CI mobile resume wiring", () => {
  it("includes the mobile resume contract and both mobile browser engines", () => {
    const workflow = source(".github/workflows/klyx-all-providers-certification.yml");
    const config = source("playwright.mobile-certification.config.ts");

    expect(workflow).toContain("tests/integration/mobile-resume-contract.test.ts");
    expect(workflow).toContain("npx playwright test --config=playwright.mobile-certification.config.ts");
    expect(config).toContain('devices["Pixel 5"]');
    expect(config).toContain('devices["iPhone 13"]');
  });
});
