import { describe, expect, it } from "vitest";

import { isStripeConnectAccountModeMismatch } from "../../lib/stripe-connect-account-recovery";

const mismatch =
  "You tried to create a live mode account link for an account that was created in test mode.";

describe("Stripe Connect raw mode mismatch", () => {
  it("checks raw.message even when top-level message is generic", () => {
    expect(
      isStripeConnectAccountModeMismatch({
        message: "Invalid request",
        raw: { message: mismatch },
      })
    ).toBe(true);
  });
});
