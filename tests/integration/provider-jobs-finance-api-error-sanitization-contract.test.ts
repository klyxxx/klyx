import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("provider jobs and finance API error sanitization contract", () => {
  it("keeps provider jobs logic in the core and sanitizes public 5xx responses", () => {
    const route = readFileSync(
      join(process.cwd(), "app/api/provider/jobs/route.ts"),
      "utf8"
    );
    const core = readFileSync(
      join(process.cwd(), "app/api/provider/jobs/jobs-route-core.ts"),
      "utf8"
    );

    expect(route).toContain("secureApiErrorResponse");
    expect(route).toContain('event: "provider_jobs_load_failed"');
    expect(route).toContain('code: "KLYX_PROVIDER_JOBS_LOAD_FAILED"');
    expect(route).toContain("response.status < 500");
    expect(route).not.toContain("detail:");
    expect(route).not.toContain("error.message");

    expect(core).toContain("KLYX_PROVIDER_MULTI_JOBS_API_12_93");
    expect(core).toContain("KLYX_PROVIDER_JOBS_LIVE_ROUTE_13_08");
    expect(core).toContain("PROVIDER_JOBS_LIVE_REVALIDATION_UNAVAILABLE");
    expect(core).toContain("detail:");
    expect(core).toContain("automaticOffer:");
    expect(core).toContain("automaticBooking:");
    expect(core).toContain("automaticPayment:");
  });

  it("keeps provider finance logic in the core and sanitizes public 5xx responses", () => {
    const route = readFileSync(
      join(process.cwd(), "app/api/provider/finance/route.ts"),
      "utf8"
    );
    const core = readFileSync(
      join(process.cwd(), "app/api/provider/finance/finance-route-core.ts"),
      "utf8"
    );

    expect(route).toContain("secureApiErrorResponse");
    expect(route).toContain('event: "provider_finance_load_failed"');
    expect(route).toContain('code: "KLYX_PROVIDER_FINANCE_LOAD_FAILED"');
    expect(route).toContain("response.status < 500");
    expect(route).not.toContain("error.message");

    expect(core).toContain("KLYX_PROVIDER_FINANCE_CURRENCY_PHASE_4");
    expect(core).toContain("KLYX_GROUP_CANONICAL_FINANCE_13_05");
    expect(core).toContain("KLYX_CANONICAL_FINANCE_RECONCILIATION_13_12");
    expect(core).toContain("automaticExecutionAllowed:");
    expect(core).toContain("apiErrorStatus");
  });
});
