import { describe, expect, it } from "vitest";

import {
  isMissingStripeConnectAccount,
  isRecoverableStripeConnectAccountForOnboarding,
  isStripeConnectAccountModeMismatch,
  isStripePlatformActivationRequired,
  isStripePlatformProfileRequired,
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
    const liveTestMismatch =
      "You tried to create a live mode account link for an account that was created in test mode.";

    expect(
      isStripeConnectAccountModeMismatch({
        message: liveTestMismatch,
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

    expect(
      isStripeConnectAccountModeMismatch({
        message: "Invalid request",
        raw: { message: liveTestMismatch },
      })
    ).toBe(true);
  });

  it("recognizes only Stripe's exact platform activation blocker", () => {
    const activationMessage =
      "Your account must be activated in order to create accounts. You can activate your accounts at https://dashboard.stripe.com/account/onboarding.";

    expect(
      isStripePlatformActivationRequired({
        message: activationMessage,
      })
    ).toBe(true);

    expect(
      isStripePlatformActivationRequired({
        raw: { message: activationMessage },
      })
    ).toBe(true);

    expect(
      isStripePlatformActivationRequired({
        message: "Invalid request",
        raw: { message: activationMessage },
      })
    ).toBe(true);

    expect(
      isStripePlatformActivationRequired({
        message: "Your account must be activated.",
      })
    ).toBe(false);
  });

  it("recognizes only Stripe's exact Connect platform-profile blocker", () => {
    const message =
      "You must complete your platform profile to use Connect and create live connected accounts. Visit your dashboard at https://dashboard.stripe.com/connect/accounts/overview to answer the questionnaire.";

    expect(isStripePlatformProfileRequired({ message })).toBe(true);
    expect(isStripePlatformProfileRequired({ raw: { message } })).toBe(true);
    expect(
      isStripePlatformProfileRequired({
        message: "Invalid request",
        raw: { message },
      })
    ).toBe(true);
    expect(
      isStripePlatformProfileRequired({
        message: "You must complete your platform profile to use Connect.",
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
        message:
          "You must complete your platform profile to use Connect and create live connected accounts. Visit your dashboard at https://dashboard.stripe.com/connect/accounts/overview to answer the questionnaire.",
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
