import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("KLYX pilot operations contract", () => {
  it("keeps the operator queue Founder-only, uncached and derived from canonical transactions", () => {
    const route = read("app/api/founder/business-pilot/operations/route.ts");

    expect(route).toContain("requireKlyxFounder");
    expect(route).toContain("secureApiErrorResponse");
    expect(route).toContain('from("business_pilot_requests")');
    expect(route).toContain('from("market_service_requests")');
    expect(route).toContain('from("market_service_offers")');
    expect(route).toContain('from("service_quotes")');
    expect(route).toContain('from("bookings")');
    expect(route).toContain('from("booking_financial_ledger")');
    expect(route).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(route).not.toMatch(/insert\(|upsert\(|\.update\(|\.delete\(/);
  });

  it("keeps hard pilot caps and expansion lock in the operations engine", () => {
    const operations = read("lib/klyx-local-value-pilot-operations.ts");
    const pilot = read("lib/klyx-local-value-pilot.ts");

    expect(operations).toContain("requestIntakeLocked");
    expect(operations).toContain("providerEnrollmentLocked");
    expect(operations).toContain("scopeExpansionLocked: true");
    expect(operations).toContain("request_cap_reached_without_proof");
    expect(operations).toContain("Ne pas augmenter le plafond");
    expect(pilot).toContain("maxActiveProviders: 5");
    expect(pilot).toContain("maxRealRequests: 20");
  });

  it("requires completed payment evidence and diverts fully refunded missions to review", () => {
    const operations = read("lib/klyx-local-value-pilot-operations.ts");

    expect(operations).toContain('entryType: "payment_succeeded" | "refund_succeeded"');
    expect(operations).toContain("successfulRefundCents >= successfulPaymentCents");
    expect(operations).toContain('if (fullyRefunded) return "financial_review"');
    expect(operations).toContain(
      'if (hasCompletedBooking && successfulPaymentCents > 0) return "completed_paid"'
    );
  });

  it("does not introduce a second category, zone or paid acquisition path", () => {
    const operations = read("lib/klyx-local-value-pilot-operations.ts");
    const route = read("app/api/founder/business-pilot/operations/route.ts");

    expect(route).toContain("KLYX_LOCAL_VALUE_PILOT.serviceSlug");
    expect(route).toContain("isPilotCity");
    expect(operations).toContain("Anneessens / Montage de meubles");
    expect(operations).toContain("sans acquisition payante");
    expect(operations).not.toContain("menage-a-domicile");
    expect(operations).not.toContain("babysitting");
  });
});
