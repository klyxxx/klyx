import { describe, expect, it } from "vitest";

import { getKlyxExternalCostDecision } from "@/lib/providers/cost-control";
import {
  executeKlyxRuntimeProviderCall,
  resetKlyxRuntimeProviderControlPlaneForTests,
} from "@/lib/providers/runtime-cost-governor";

describe("KLYX runtime external cost governor", () => {
  it("keeps the runtime fail-closed at zero cost", async () => {
    delete process.env.KLYX_EXTERNAL_COST_MODE;
    delete process.env.KLYX_PROVIDER_OPENAI_ENABLED;
    delete process.env.KLYX_PROVIDER_OPENAI_SPEND_CAP_CONFIRMED;
    delete process.env.KLYX_PROVIDER_OPENAI_MONTHLY_BUDGET_MINOR;
    delete process.env.KLYX_OPENAI_ENABLED;
    resetKlyxRuntimeProviderControlPlaneForTests();

    expect(getKlyxExternalCostDecision("openai")).toMatchObject({
      allowed: false,
      reason: "ZERO_COST_BLOCK",
    });

    await expect(
      executeKlyxRuntimeProviderCall({
        provider: "openai",
        capability: "text_generation",
        operation: "generate",
        kind: "read",
        retrySafety: "read_only",
        estimatedCostMinor: 1,
        costCurrency: "USD",
        payload: null,
        adapter: {
          provider: "openai",
          capabilities: ["text_generation"],
          async execute() {
            throw new Error("network must never be reached");
          },
        },
      })
    ).rejects.toThrow(
      "KLYX_EXTERNAL_PROVIDER_GUARD:openai:PROVIDER_DISABLED"
    );
  });

  it("enforces the guarded budget", async () => {
    Object.assign(process.env, {
      KLYX_EXTERNAL_COST_MODE: "guarded",
      KLYX_PROVIDER_OPENAI_ENABLED: "1",
      KLYX_PROVIDER_OPENAI_SPEND_CAP_CONFIRMED: "1",
      KLYX_PROVIDER_OPENAI_MONTHLY_BUDGET_MINOR: "2",
      KLYX_OPENAI_ENABLED: "1",
    });
    resetKlyxRuntimeProviderControlPlaneForTests();

    const adapter = {
      provider: "openai" as const,
      capabilities: ["text_generation"],
      async execute() {
        return { ok: true };
      },
    };

    await expect(
      executeKlyxRuntimeProviderCall({
        provider: "openai",
        capability: "text_generation",
        operation: "generate",
        kind: "read",
        retrySafety: "read_only",
        estimatedCostMinor: 2,
        costCurrency: "USD",
        payload: null,
        adapter,
        actualCost: () => ({ minor: 2, currency: "USD" }),
      })
    ).resolves.toEqual({ ok: true });

    await expect(
      executeKlyxRuntimeProviderCall({
        provider: "openai",
        capability: "text_generation",
        operation: "generate",
        kind: "read",
        retrySafety: "read_only",
        estimatedCostMinor: 1,
        costCurrency: "USD",
        payload: null,
        adapter,
      })
    ).rejects.toThrow(
      "KLYX_EXTERNAL_PROVIDER_GUARD:openai:BUDGET_EXCEEDED"
    );

    for (const key of [
      "KLYX_EXTERNAL_COST_MODE",
      "KLYX_PROVIDER_OPENAI_ENABLED",
      "KLYX_PROVIDER_OPENAI_SPEND_CAP_CONFIRMED",
      "KLYX_PROVIDER_OPENAI_MONTHLY_BUDGET_MINOR",
      "KLYX_OPENAI_ENABLED",
    ]) {
      delete process.env[key];
    }
    resetKlyxRuntimeProviderControlPlaneForTests();
  });
});