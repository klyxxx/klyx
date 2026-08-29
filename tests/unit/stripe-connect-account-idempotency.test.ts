import { describe, expect, it } from "vitest";

import { stripeConnectAccountCreateIdempotencyKey } from "../../lib/stripe-connect-account-idempotency";

describe("Stripe Connect account creation idempotency", () => {
  it("keeps initial account retries stable per profile and Stripe mode", () => {
    expect(
      stripeConnectAccountCreateIdempotencyKey({
        profileId: "profile-123",
        runtimeMode: "test",
      })
    ).toBe("klyx-connect-account-test-profile-123-initial-v2");

    expect(
      stripeConnectAccountCreateIdempotencyKey({
        profileId: "profile-123",
        runtimeMode: "live",
      })
    ).toBe("klyx-connect-account-live-profile-123-initial-v2");
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
    expect(first).toContain("replace-acct_old_1-v2");
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
    expect(first.endsWith("-v2")).toBe(true);
  });

  it("normalizes untrusted key fragments", () => {
    const key = stripeConnectAccountCreateIdempotencyKey({
      profileId: " profile:with spaces ",
      runtimeMode: "test",
      staleAccountId: " acct/old ",
    });

    expect(key).toBe(
      "klyx-connect-account-test-profile-with-spaces-replace-acct-old-v2"
    );
    expect(key.length).toBeLessThanOrEqual(255);
  });
});
