import { describe, expect, it } from "vitest";

import { stripeConnectAccountCreateIdempotencyKey } from "../../lib/stripe-connect-account-idempotency";

describe("Stripe Connect account creation idempotency", () => {
  it("keeps retries stable per canonical KLYX account and Stripe mode", () => {
    expect(
      stripeConnectAccountCreateIdempotencyKey({
        accountId: "account-123",
        runtimeMode: "test",
      })
    ).toBe("klyx-connect-account-test-account-123-initial-v4");

    expect(
      stripeConnectAccountCreateIdempotencyKey({
        accountId: "account-123",
        runtimeMode: "live",
      })
    ).toBe("klyx-connect-account-live-account-123-initial-v4");
  });

  it("does not vary when a legacy active profile changes", () => {
    const first = stripeConnectAccountCreateIdempotencyKey({
      accountId: "account-123",
      runtimeMode: "live",
    });
    const retry = stripeConnectAccountCreateIdempotencyKey({
      accountId: "account-123",
      runtimeMode: "live",
    });

    expect(first).toBe(retry);
    expect(first).not.toContain("profile");
  });

  it("rotates the account-create key revision without making retries random", () => {
    const first = stripeConnectAccountCreateIdempotencyKey({
      accountId: "account-123",
      runtimeMode: "live",
    });
    const retry = stripeConnectAccountCreateIdempotencyKey({
      accountId: "account-123",
      runtimeMode: "live",
    });

    expect(first).toBe(retry);
    expect(first.endsWith("-v4")).toBe(true);
  });

  it("normalizes untrusted key fragments", () => {
    const key = stripeConnectAccountCreateIdempotencyKey({
      accountId: " account:with spaces ",
      runtimeMode: "test",
    });

    expect(key).toBe(
      "klyx-connect-account-test-account-with-spaces-initial-v4"
    );
    expect(key.length).toBeLessThanOrEqual(255);
  });
});
