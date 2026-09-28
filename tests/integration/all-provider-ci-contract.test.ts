import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const workflow = fs.readFileSync(
  path.join(process.cwd(), ".github/workflows/klyx-all-providers-certification.yml"),
  "utf8"
);

describe("KLYX all-provider CI contract", () => {
  it("runs recovery, autonomous, type, build, finance and Web/mobile gates", () => {
    for (const needle of [
      "Dedicated provider recovery certification",
      "npm run certify:autonomous:offline",
      "TypeScript",
      "Production build",
      "economic-settlement-eligibility-contract.test.ts",
      "settlement-recovery-reconciliation-contract.test.ts",
      "Web Android iOS browser certification",
      "playwright.providers.config.ts",
      "Enforce certification verdict",
    ]) {
      expect(workflow).toContain(needle);
    }
  });
});
