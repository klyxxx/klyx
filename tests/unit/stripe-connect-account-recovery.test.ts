import { describe, expect, it } from "vitest";

import {
  isMissingStripeConnectAccount,
  isRecoverableStripeConnectAccountForOnboarding,
  isStripeConnectAccountModeMismatch,
  isStripePlatformActivationRequired,
} from "../../lib/stripe-connect-account-recovery";

describe("Stripe Connect stale account recovery", () => {
  it("accepts Stripe resource_missing for the connected account", () => {
    expect(
      isMissingStripeConnectAccount({
        code: "resource_missing",
        param: "account",
      })
    ).toBe(true);

    expect(
      isMissingStripeConnectAccount({
        raw: { code: "resource_missing" },
      })
    ).toBe(true);
  });

  it("accepts Stripe's explicit live/test account-link mismatch", () => {
    expect(
      isStripeConnectAccountModeMismatch({
        message:
          "You tried to create a live mode account link for an account that was created in test mode.",
      })
    ).toBe(true);

    expect(
      isStripeConnectAccountModeMismatch({
        raw: {
          message:
            "You tried to create a test mode account link for an account that was created in live mode.",
        },
      })
    ).toBe(true);
  });

  it("recognizes only Stripe's exact platform activation blocker", () => {
    expect(
      isStripePlatformActivationRequired({
        message:
          "Your account must be activated in order to create accounts. You can activate your accounts at https://dashboard.stripe.com/account/onboarding.",
      })
    ).toBe(true);

    expect(
      isStripePlatformActivationRequired({
        raw: {
          message:
            "Your account must be activated in order to create accounts. You can activate your accounts at https://dashboard.stripe.com/account/onboarding.",
        },
      })
    ).toBe(true);

    expect(
      isStripePlatformActivationRequired({
        message: "Your account must be activated.",
      })
    ).toBe(false);
  });

  it("does not broaden mode-mismatch recovery to arbitrary 400 errors", () => {
    expect(
      isStripeConnectAccountModeMismatch({
        message: "Invalid account link request.",
        type: "invalid_request_error",
        statusCode: 400,
      })
    ).toBe(false);

    expect(
      isStripeConnectAccountModeMismatch({
        message:
          "You tried to create a live mode account link for an account that was created in test mode. extra",
      })
    ).toBe(false);
  });

  it("recovers onboarding only for missing accounts or explicit mode mismatch", () => {
    expect(
      isRecoverableStripeConnectAccountForOnboarding({
        code: "resource_missing",
        param: "account",
      })
    ).toBe(true);

    expect(
      isRecoverableStripeConnectAccountForOnboarding({
        message:
          "You tried to create a live mode account link for an account that was created in test mode.",
      })
    ).toBe(true);

    expect(
      isRecoverableStripeConnectAccountForOnboarding({
        message:
          "Your account must be activated in order to create accounts. You can activate your accounts at https://dashboard.stripe.com/account/onboarding.",
      })
    ).toBe(false);

    expect(
      isRecoverableStripeConnectAccountForOnboarding({
        code: "api_error",
      })
    ).toBe(false);
  });

  it("does not recover unrelated missing resources or transient errors", () => {
    expect(
      isMissingStripeConnectAccount({
        code: "resource_missing",
        param: "person",
      })
    ).toBe(false);
    expect(
      isMissingStripeConnectAccount({ code: "api_error" })
    ).toBe(false);
    expect(isMissingStripeConnectAccount(new Error("timeout"))).toBe(false);
  });
});
