import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const workflow = fs.readFileSync(
  path.join(process.cwd(), ".github/workflows/klyx-all-providers-certification.yml"),
  "utf8"
);

describe("KLYX no-false-PASS contract", () => {
  it("fails the job when any certification gate fails", () => {
    expect(workflow).not.toContain("continue-on-error: true");
    expect(workflow).toContain("Production build");
    expect(workflow).toContain("Android and iOS PWA browser certification");
  });
});
