import {
  describe,
  expect,
  it,
} from "vitest";

import {
  splitMissionStripeBlockMessageKey,
  splitMissionStripeProviderStateMessageKey,
} from "../../lib/klyx-split-mission-stripe-readiness";

// KLYX_SPLIT_STRIPE_READINESS_UNIT_15_05

describe("split mission Stripe readiness labels", () => {
  it("maps market blockers explicitly", () => {
    expect(
      splitMissionStripeBlockMessageKey("CLIENT_MARKET_NOT_READY")
    ).toBe("blockClientMarketNotReady");
    expect(
      splitMissionStripeBlockMessageKey("PROVIDER_MARKET_NOT_READY")
    ).toBe("blockProviderMarketNotReady");
  });

  it("maps provider profile and market states explicitly", () => {
    expect(splitMissionStripeProviderStateMessageKey("missing_profile")).toBe(
      "stateMissingProfile"
    );
    expect(splitMissionStripeProviderStateMessageKey("market_not_ready")).toBe(
      "stateMarketNotReady"
    );
  });

  it("keeps safe fallback labels for unknown server values", () => {
    expect(splitMissionStripeBlockMessageKey("UNKNOWN")).toBe("blockDefault");
    expect(splitMissionStripeProviderStateMessageKey("UNKNOWN")).toBe(
      "stateRestricted"
    );
  });
});
