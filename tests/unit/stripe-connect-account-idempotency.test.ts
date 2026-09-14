import { describe, expect, it } from "vitest";

import { stripeConnectAccountCreateIdempotencyKey } from "../../lib/stripe-connect-account-idempotency";

describe("Stripe Connect account creation idempotency", () => {
  it("keeps retries stable per canonical KLYX account and Stripe mode", () => {
    expect(
      stripeConnectAccountCreateIdempotencyKey({
        accountId: "account-123",
        runtimeMode: "test",
      })
    ).toBe("klyx-connect-account-test-account-123-account-v1");

    expect(
      stripeConnectAccountCreateIdempotencyKey({
        accountId: "account-123",
        runtimeMode: "live",
      })
    ).toBe("klyx-connect-account-live-account-123-account-v1");
  });

  it("does not expose any stale-account replacement key path", () => {
    const first = stripeConnectAccountCreateIdempotencyKey({
      accountId: "account-123",
      runtimeMode: "live",
    });
    const retry = stripeConnectAccountCreateIdempotencyKey({
      accountId: "account-123",
      runtimeMode: "live",
    });

    expect(retry).toBe(first);
    expect(first).not.toContain("replace-");
    expect(first).not.toContain("profile-");
  });

  it("isolates different canonical accounts without rotating identity", () => {
    const first = stripeConnectAccountCreateIdempotencyKey({
      accountId: "account-123",
      runtimeMode: "live",
    });
    const second = stripeConnectAccountCreateIdempotencyKey({
      accountId: "account-456",
      runtimeMode: "live",
    });

    expect(first).not.toBe(second);
    expect(first.endsWith("-account-v1")).toBe(true);
  });

  it("normalizes untrusted account key fragments", () => {
    const key = stripeConnectAccountCreateIdempotencyKey({
      accountId: " account:with spaces ",
      runtimeMode: "test",
    });

    expect(key).toBe(
      "klyx-connect-account-test-account-with-spaces-account-v1"
    );
    expect(key.length).toBeLessThanOrEqual(255);
  });
});
