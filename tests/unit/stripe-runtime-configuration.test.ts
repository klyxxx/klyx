import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertStripeRuntimeConfigured,
  assertStripeRuntimeReady,
} from "../../lib/stripe-runtime";

const ENV_KEYS = [
  "KLYX_STRIPE_MODE",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "KLYX_COMMISSION_PERCENT",
  "KLYX_ALLOW_PLATFORM_ONLY_TEST_PAYMENTS",
  "KLYX_LIVE_PAYMENTS_ENABLED",
] as const;

const previousEnv = new Map<string, string | undefined>();

describe("KLYX Stripe runtime configuration assertion", () => {
  beforeEach(() => {
    previousEnv.clear();

    for (const key of ENV_KEYS) {
      previousEnv.set(key, process.env[key]);
    }

    process.env.KLYX_STRIPE_MODE = "live";
    process.env.STRIPE_SECRET_KEY = "sk_live_klyx_test";
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_live_klyx_test";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_klyx_test";
    process.env.NEXT_PUBLIC_APP_URL = "https://klyx.example";
    process.env.KLYX_COMMISSION_PERCENT = "15";
    process.env.KLYX_ALLOW_PLATFORM_ONLY_TEST_PAYMENTS = "false";
    process.env.KLYX_LIVE_PAYMENTS_ENABLED = "false";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const previous = previousEnv.get(key);

      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }
  });

  it("allows status diagnostics when only the live payment switch is disabled", () => {
    const report = assertStripeRuntimeConfigured();

    expect(report.mode).toBe("live");
    expect(report.livePaymentsEnabled).toBe(false);
    expect(report.ready).toBe(false);
    expect(report.checks.find((check) => check.key === "live_switch")?.ok).toBe(
      false
    );
    expect(() => assertStripeRuntimeReady()).toThrow(
      /Activation des paiements reels/
    );
  });

  it("still rejects malformed Stripe configuration", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_wrong_mode";

    expect(() => assertStripeRuntimeConfigured()).toThrow(
      /Cle secrete Stripe/
    );
  });
});
