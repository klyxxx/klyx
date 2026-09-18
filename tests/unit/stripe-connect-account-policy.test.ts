import { describe, expect, it } from "vitest";

import { assessStripeConnectCreation } from "../../lib/stripe-connect-account-policy";

describe("account-level Stripe Connect identity policy", () => {
  it("creates only when the canonical account and its history are empty", () => {
    expect(
      assessStripeConnectCreation({
        state: "unlinked",
        canonicalStripeAccountId: null,
        historicalStripeAccountIds: [],
      })
    ).toBe("create");
  });

  it("reuses the canonical account when history agrees", () => {
    expect(
      assessStripeConnectCreation({
        state: "linked",
        canonicalStripeAccountId: "acct_existing",
        historicalStripeAccountIds: ["acct_existing", "acct_existing"],
      })
    ).toBe("reuse");
  });

  it("never replaces an existing historical Stripe identity", () => {
    expect(
      assessStripeConnectCreation({
        state: "unlinked",
        canonicalStripeAccountId: null,
        historicalStripeAccountIds: ["acct_legacy"],
      })
    ).toBe("review_required");
  });

  it("fails closed when canonical and historical identities disagree", () => {
    expect(
      assessStripeConnectCreation({
        state: "linked",
        canonicalStripeAccountId: "acct_canonical",
        historicalStripeAccountIds: ["acct_legacy"],
      })
    ).toBe("review_required");
  });

  it("fails closed for an account already requiring review", () => {
    expect(
      assessStripeConnectCreation({
        state: "review_required",
        canonicalStripeAccountId: "acct_one",
        historicalStripeAccountIds: ["acct_one", "acct_two"],
      })
    ).toBe("review_required");
  });
});
