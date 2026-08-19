import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("security risk API error sanitization contract", () => {
  it("secures the public route while retaining the original risk engine core", () => {
    const routeSource = readFileSync(
      join(process.cwd(), "app/api/security/risk/route.ts"),
      "utf8"
    );
    const coreSource = readFileSync(
      join(process.cwd(), "app/api/security/risk/risk-route-core.ts"),
      "utf8"
    );

    expect(routeSource).toContain("secureApiErrorResponse");
    expect(routeSource).toContain("KLYX_SECURITY_RISK_EVALUATION_FAILED");
    expect(routeSource).toContain("response.status < 500");
    expect(routeSource).not.toContain("{ error: message }");

    expect(coreSource).toContain("calculateRisk");
    expect(coreSource).toContain("profile_risk_assessments");
    expect(coreSource).toContain("security_alerts");
    expect(coreSource).toContain("automaticRestriction: false");
    expect(coreSource).toContain("export async function POST");
    expect(coreSource).toContain("return GET(request)");
    expect(coreSource).toContain("{ error: message }");
  });
});
