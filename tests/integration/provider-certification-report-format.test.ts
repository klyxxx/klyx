import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const scope = fs.readFileSync(
  path.join(process.cwd(), "CERTIFICATION_ALL_PROVIDERS.md"),
  "utf8"
);

describe("KLYX provider report format", () => {
  it("keeps certification scoped to exact evidence rather than inferred PASS", () => {
    expect(scope).toContain("Target: certify");
    expect(scope).toContain("No Stripe LIVE action");
  });
});
