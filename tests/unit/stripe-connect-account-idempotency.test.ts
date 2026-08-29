import { describe, expect, it } from "vitest";

import { stripeConnectAccountCreateIdempotencyKey } from "../../lib/stripe-connect-account-idempotency";

describe("Stripe Connect account creation idempotency", () => {
  it("keeps initial account retries stable per profile and Stripe mode", () => {
    expect(
      stripeConnectAccountCreateIdempotencyKey({
        profileId: "profile-123",
        runtimeMode: "test",
      })
    ).toBe("klyx-connect-account-test-profile-123-initial-v3");

    expect(
      stripeConnectAccountCreateIdempotencyKey({
        profileId: "profile-123",
        runtimeMode: "live",
      })
    ).toBe("klyx-connect-account-live-profile-123-initial-v3");
  });

  it("uses the stale account id to isolate replacement retries", () => {
    const first = stripeConnectAccountCreateIdempotencyKey({
      profileId: "profile-123",
      runtimeMode: "live",
      staleAccountId: "acct_old_1",
    });
    const retry = stripeConnectAccountCreateIdempotencyKey({
      profileId: "profile-123",
      runtimeMode: "live",
      staleAccountId: "acct_old_1",
    });
    const nextReplacement = stripeConnectAccountCreateIdempotencyKey({
      profileId: "profile-123",
      runtimeMode: "live",
      staleAccountId: "acct_old_2",
    });

    expect(retry).toBe(first);
    expect(nextReplacement).not.toBe(first);
    expect(first).toContain("replace-acct_old_1-v3");
  });

  it("rotates the account-create key revision without making retries random", () => {
    const first = stripeConnectAccountCreateIdempotencyKey({
      profileId: "profile-123",
      runtimeMode: "live",
      staleAccountId: "acct_old_1",
    });
    const retry = stripeConnectAccountCreateIdempotencyKey({
      profileId: "profile-123",
      runtimeMode: "live",
      staleAccountId: "acct_old_1",
    });

    expect(first).toBe(retry);
    expect(first.endsWith("-v3")).toBe(true);
  });

  it("normalizes untrusted key fragments", () => {
    const key = stripeConnectAccountCreateIdempotencyKey({
      profileId: " profile:with spaces ",
      runtimeMode: "test",
      staleAccountId: " acct/old ",
    });

    expect(key).toBe(
      "klyx-connect-account-test-profile-with-spaces-replace-acct-old-v3"
    );
    expect(key.length).toBeLessThanOrEqual(255);
  });
});
