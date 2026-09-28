import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const workflow = fs.readFileSync(
  path.join(process.cwd(), ".github/workflows/klyx-all-providers-certification.yml"),
  "utf8"
);

describe("KLYX all-provider immutable SHA contract", () => {
  it("supports an exact SHA certification gate", () => {
    expect(workflow).toContain("expected_sha");
    expect(workflow).toContain("Certification SHA mismatch");
    expect(workflow).toContain("github.sha");
    expect(workflow).toContain("KLYX_CERT_SHA");
    expect(workflow).toContain("Verify exact checkout");
  });
});
