import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

// KLYX_SPLIT_CHECKOUT_READINESS_CONTRACT_15_05

const checkoutUi = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/bookings/split/[id]/SplitMissionCheckout.tsx"
  ),
  "utf8"
);

const readinessUi = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/bookings/split/[id]/SplitMissionStripeReadiness.tsx"
  ),
  "utf8"
);

const checkoutRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/bookings/split-missions/[id]/checkout/route.ts"
  ),
  "utf8"
);

const readinessRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/bookings/split-missions/[id]/stripe-readiness/route.ts"
  ),
  "utf8"
);

describe("KLYX split mission checkout readiness contract", () => {
  it("gates new checkout preparation on the live readiness endpoint", () => {
    expect(checkoutUi).toContain("KLYX_SPLIT_CHECKOUT_READINESS_GATE_15_05");
    expect(checkoutUi).toContain('"/stripe-readiness"');
    expect(checkoutUi).toContain(
      "stripeReadiness?.stripeReadinessComplete === true"
    );
    expect(checkoutUi).toContain("stripeReadiness.checkoutReady === true");
    expect(checkoutUi).toContain("checkoutPreparationReady ? (");
    expect(checkoutUi).toContain('readinessT("blockedTitle")');
  });

  it("keeps already prepared payment units visible independently of readiness", () => {
    expect(checkoutUi).toContain("!result?.prepared ? (");
    expect(checkoutUi).toContain("units.map((unit, index)");
    expect(checkoutUi).toContain("unit.checkoutUrl");
  });

  it("uses checkoutReady for the global readiness UI and market blockers", () => {
    expect(readinessUi).toContain("KLYX_SPLIT_STRIPE_READINESS_UI_CONTRACT_15_05");
    expect(readinessUi).toContain("result?.checkoutReady ? (");
    expect(readinessUi).toContain("splitMissionStripeBlockMessageKey");
    expect(readinessUi).toContain("splitMissionStripeProviderStateMessageKey");
    expect(readinessRoute).toContain('blockReason = "CLIENT_MARKET_NOT_READY"');
    expect(readinessRoute).toContain('blockReason = "PROVIDER_MARKET_NOT_READY"');
  });

  it("keeps the POST checkout route as the independent final authority", () => {
    expect(checkoutRoute).toContain("assessKlyxStripeMarketAccess");
    expect(checkoutRoute).toContain("clientMarketAccess.allowed");
    expect(checkoutRoute).toContain("providerMarketAccess.allowed");
    expect(checkoutRoute).toContain("checkoutPreparationConfirmed");
  });
});
