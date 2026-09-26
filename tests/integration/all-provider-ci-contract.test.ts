import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const workflow = fs.readFileSync(
  path.join(process.cwd(), ".github/workflows/klyx-all-providers-certification.yml"),
  "utf8"
);

describe("KLYX all-provider CI contract", () => {
  it("runs recovery, autonomous, type, build, finance, Android and iOS gates", () => {
    for (const needle of [
      "Provider recovery tests",
      "Autonomous recovery certification",
      "TypeScript",
      "Production build",
      "economic-settlement-eligibility-contract.test.ts",
      "settlement-recovery-reconciliation-contract.test.ts",
      "Android and iOS PWA browser certification",
    ]) {
      expect(workflow).toContain(needle);
    }
  });
});
