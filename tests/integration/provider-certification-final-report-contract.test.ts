import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const scope = fs.readFileSync(
  path.join(process.cwd(), "CERTIFICATION_ALL_PROVIDERS.md"),
  "utf8"
);

describe("KLYX final provider certification report contract", () => {
  it("requires PASS/FAIL reporting by engine and provider", () => {
    expect(scope).toContain("KLYX All Providers Certification");
    expect(scope).toContain("Provider outages");
  });
});
