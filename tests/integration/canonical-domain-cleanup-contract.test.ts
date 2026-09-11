import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const OLD_DOMAIN = "klyx-ten.vercel.app";
const CANONICAL_DOMAIN = "https://klyx.be";

const files = [
  "lib/klyx-public-config.ts",
  "scripts/check-step-12-6.ps1",
  "scripts/check-step-10-4-production.ps1",
  ".github/workflows/klyx-operational-sentinel.yml",
  "tests/integration/operational-sentinel-contract.test.ts",
];

describe("KLYX canonical production domain", () => {
  it("removes the legacy Vercel domain from active production configuration", () => {
    for (const file of files) {
      const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source, file).not.toContain(OLD_DOMAIN);
    }

    const publicConfig = fs.readFileSync(
      path.join(process.cwd(), "lib/klyx-public-config.ts"),
      "utf8"
    );
    const workflow = fs.readFileSync(
      path.join(process.cwd(), ".github/workflows/klyx-operational-sentinel.yml"),
      "utf8"
    );

    expect(publicConfig).toContain(CANONICAL_DOMAIN);
    expect(workflow).toContain(CANONICAL_DOMAIN);
  });
});
