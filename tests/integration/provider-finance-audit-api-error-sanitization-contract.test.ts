import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("provider finance audit API error sanitization contract", () => {
  it("preserves the audit core while securing unexpected 5xx responses", () => {
    const route = readFileSync(
      join(process.cwd(), "app/api/provider/finance-audit/route.ts"),
      "utf8"
    );
    const core = readFileSync(
      join(process.cwd(), "app/api/provider/finance-audit/finance-audit-route-core.ts"),
      "utf8"
    );

    expect(route).toContain("secureApiErrorResponse");
    expect(route).toContain('code: "KLYX_PROVIDER_FINANCE_AUDIT_FAILED"');
    expect(route).toContain("automaticExecutionAllowed: false");
    expect(route).not.toContain("error.message");

    expect(core).toContain("KLYX_GROUP_FINANCE_AUDIT_API_13_03");
    expect(core).toContain('auditVersion:\n        "13.03"');
    expect(core).toContain("readOnly:\n        true");
    expect(core).toContain("automaticExecutionAllowed:\n        false");
    expect(core).toContain("stripe_payment_intent_id");
    expect(core).toContain("stripe_refund_id");
  });
});
