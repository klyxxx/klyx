import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("provider certification runtime safety", () => {
  it("keeps outage simulation isolated from destructive provider shutdowns", () => {
    const workflow = source(".github/workflows/klyx-all-providers-certification.yml");
    const scope = source("CERTIFICATION_ALL_PROVIDERS.md");

    expect(scope).toContain("Provider outages are injected through deterministic tests/mocks");
    expect(workflow).toContain("Refuse Stripe LIVE");
    expect(workflow).toContain("Read-only real provider probes");
    expect(workflow).not.toContain("stripe trigger");
  });
});
