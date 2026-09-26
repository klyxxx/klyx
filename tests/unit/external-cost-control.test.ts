import { describe, expect, it } from "vitest";

import {
  evaluateKlyxExternalCost,
  KLYX_EXTERNAL_PROVIDER_DEFAULTS,
  type KlyxExternalProvider,
} from "@/lib/external-cost-control";

const zeroSafeProviders: KlyxExternalProvider[] = [
  "supabase",
  "resend",
  "tolgee",
  "cloudflare",
  "vercel",
  "github",
];

const zeroBlockedProviders: KlyxExternalProvider[] = [
  "openai",
  "stripe",
  "sumsub",
  "twilio",
  "elmah_io",
];

describe("KLYX external cost policy", () => {
  it("keeps zero-budget development providers available", () => {
    for (const provider of zeroSafeProviders) {
      const result = evaluateKlyxExternalCost({
        mode: "zero",
        provider,
      });

      expect(result.allowed, provider).toBe(true);
      expect(result.circuit, provider).toBe("closed");
    }
  });

  it("opens the cost circuit for metered or fixed-cost providers in zero mode", () => {
    for (const provider of zeroBlockedProviders) {
      const result = evaluateKlyxExternalCost({
        mode: "zero",
        provider,
      });

      expect(result.allowed, provider).toBe(false);
      expect(result.circuit, provider).toBe("open");
      expect(result.reason, provider).toBe("ZERO_BUDGET_MODE");
    }
  });

  it("refuses guarded metered calls without an explicit positive budget", () => {
    const result = evaluateKlyxExternalCost({
      mode: "guarded",
      provider: "openai",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("BUDGET_NOT_CONFIGURED");
  });

  it("reserves OpenAI conservatively and derives a finite call ceiling", () => {
    const result = evaluateKlyxExternalCost({
      mode: "guarded",
      provider: "openai",
      monthlyBudgetMicroUsd: 1_000_000,
    });

    expect(KLYX_EXTERNAL_PROVIDER_DEFAULTS.openai.estimatedCostMicroUsd).toBe(
      100_000
    );
    expect(result.allowed).toBe(true);
    expect(result.maxCallsFromBudget).toBe(10);
  });

  it("does not enable Sumsub below its minimum monthly commitment", () => {
    const belowMinimum = evaluateKlyxExternalCost({
      mode: "guarded",
      provider: "sumsub",
      monthlyBudgetMicroUsd: 148_999_999,
    });

    expect(belowMinimum.allowed).toBe(false);
    expect(belowMinimum.reason).toBe("MINIMUM_COMMITMENT_EXCEEDS_BUDGET");

    const atMinimum = evaluateKlyxExternalCost({
      mode: "guarded",
      provider: "sumsub",
      monthlyBudgetMicroUsd: 149_000_000,
    });

    expect(atMinimum.allowed).toBe(true);
    expect(atMinimum.maxCallsFromBudget).toBe(110);
  });

  it("does not expose an uncapped normal mode", () => {
    const source = JSON.stringify(KLYX_EXTERNAL_PROVIDER_DEFAULTS);
    expect(source).not.toContain('"normal"');
  });
});
