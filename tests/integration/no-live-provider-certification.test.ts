import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const workflow = fs.readFileSync(
  path.join(process.cwd(), ".github/workflows/klyx-all-providers-certification.yml"),
  "utf8"
);

describe("KLYX all-provider certification safety", () => {
  it("does not arm Stripe LIVE", () => {
    expect(workflow).not.toContain("sk_live_");
    expect(workflow).not.toContain("KLYX_LIVE_PAYMENTS_ENABLED: true");
    expect(workflow).toContain("Refuse Stripe LIVE");
    expect(workflow).toContain('KLYX_LIVE_PAYMENTS_ENABLED: "false"');
    expect(workflow).toContain("All-provider certification requires Stripe sk_test_* only.");
  });
});
