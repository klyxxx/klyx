import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (p: string) =>
  fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

const earnHarness = read("scripts/mission19-earn-market-lifecycle.mjs");
const stripeNetwork = read(
  "scripts/golden-path-platform-held-settlement-network.mjs"
);
const authorityMigration = read(
  "supabase/migrations/20260922171500_klyx_earn_settlement_completion_authority.sql"
);
const goldenWorkflow = read(".github/workflows/klyx-golden-path.yml");

describe("Mission 19 earn runtime certification contract", () => {
  it("uses real market authorities before advancing earn workflow steps", () => {
    expect(earnHarness).toContain('path: "/api/market/requests"');
    expect(earnHarness).toContain('path: "/api/provider/jobs"');
    expect(earnHarness).toContain(
      'path: `/api/market/requests/${requestId}/offers`'
    );
    expect(earnHarness).toContain('action: "accept"');
    expect(earnHarness).toContain('path: "/api/bookings/create"');
    expect(earnHarness).toContain('quoteApplied === true');
    expect(earnHarness).toContain('path: "/api/bookings/status"');
  });

  it("keeps sensitive provider mutations explicit instead of automatic", () => {
    expect(earnHarness).toContain("prematureBookings === 0");
    expect(earnHarness).toContain("jobs?.automaticOffer !== true");
    expect(earnHarness).toContain("jobs?.automaticBooking !== true");
    expect(earnHarness).toContain("jobs?.automaticPayment !== true");
  });

  it("walks the canonical earn state machine with domain ids in audit payloads", () => {
    for (const step of [
      "opportunities",
      "eligibility",
      "proposal",
      "acceptance",
      "mission",
    ]) {
      expect(earnHarness).toContain(`toStep: "${step}"`);
    }

    expect(earnHarness).toContain("market_request_id: requestId");
    expect(earnHarness).toContain("offer_id: offerId");
    expect(earnHarness).toContain("quote_id: quoteId");
    expect(earnHarness).toContain("booking_id: bookingId");
  });

  it("requires canonical released settlement truth before terminal completion", () => {
    expect(authorityMigration).toContain(
      "v_settlement.state <> 'released'"
    );
    expect(authorityMigration).toContain(
      "KLYX_WORKFLOW_SETTLEMENT_PROOF_REQUIRED"
    );
    expect(stripeNetwork).toContain(
      "advanceMission19EarnToSettlement(admin, earnHandoff, booking.id)"
    );
    expect(stripeNetwork).toContain(
      "completeMission19EarnFromReleasedSettlement"
    );
    expect(stripeNetwork).toContain(
      'released.state === "released"'
    );
    expect(stripeNetwork).toContain(
      '"klyx_complete_settlement_workflow"'
    );
  });

  it("makes the market half mandatory in the main Golden Path", () => {
    expect(goldenWorkflow).toContain(
      "Verify Mission 19 earn market lifecycle to mission"
    );
    expect(goldenWorkflow).toContain(
      "node scripts/mission19-earn-market-lifecycle.mjs"
    );
  });
});
