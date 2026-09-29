import { describe, expect, it } from "vitest";

import {
  KlyxProviderControlPlane,
  executeWithKlyxProviderControlPlane,
} from "@/lib/providers/control-plane";
import {
  KlyxProviderExecutionError,
  type KlyxProviderAuditEvent,
  type KlyxProviderExecutionAdapter,
} from "@/lib/providers/control-plane-contracts";
import { createKlyxProviderControlPlanePolicy } from "@/lib/providers/control-plane-registry";

const readOperation = {
  provider: "openai" as const,
  capability: "llm",
  operation: "generate",
  kind: "read" as const,
  retrySafety: "read_only" as const,
};

function registration(
  overrides: Parameters<typeof createKlyxProviderControlPlanePolicy>[1] = {}
) {
  return {
    provider: "openai" as const,
    capabilities: ["llm"] as const,
    authorityBoundary: "test boundary",
    policy: createKlyxProviderControlPlanePolicy("openai", overrides),
  };
}

describe("Provider Control Plane safety invariants", () => {
  it("blocks an exhausted budget even when the next request has no cost estimate", () => {
    const controlPlane = new KlyxProviderControlPlane([
      registration({
        budget: {
          currency: "USD",
          maxMinor: 100,
          windowMs: 60_000,
        },
      }),
    ]);

    const first = controlPlane.admit({
      ...readOperation,
      estimatedCostMinor: 100,
      costCurrency: "USD",
    });
    expect(first.allowed).toBe(true);
    if (!first.allowed) {
      throw new Error("expected first provider call to be admitted");
    }

    controlPlane.recordAttempt(first.permit, {
      ok: true,
      code: "OK",
      actualCostMinor: 100,
      costCurrency: "USD",
    });

    expect(controlPlane.snapshot("openai").budgetUsedMinor).toBe(100);
    expect(controlPlane.admit(readOperation)).toMatchObject({
      allowed: false,
      reason: "BUDGET_EXCEEDED",
    });
  });

  it("settles an attempt permit exactly once so replay cannot double-count budget", () => {
    const controlPlane = new KlyxProviderControlPlane([
      registration({
        budget: {
          currency: "USD",
          maxMinor: 100,
          windowMs: 60_000,
        },
      }),
    ]);

    const admission = controlPlane.admit(readOperation);
    expect(admission.allowed).toBe(true);
    if (!admission.allowed) {
      throw new Error("expected provider call to be admitted");
    }

    const result = {
      ok: true,
      code: "OK",
      actualCostMinor: 25,
      costCurrency: "USD",
    } as const;

    controlPlane.recordAttempt(admission.permit, result);
    expect(() =>
      controlPlane.recordAttempt(admission.permit, result)
    ).toThrow(/provider attempt is not active/);
    expect(controlPlane.snapshot("openai").budgetUsedMinor).toBe(25);
  });

  it("rejects adapters that do not advertise the requested capability", async () => {
    let calls = 0;
    const adapter: KlyxProviderExecutionAdapter<string, string> = {
      provider: "openai",
      capabilities: ["vision"],
      async execute() {
        calls += 1;
        return "unexpected";
      },
    };
    const controlPlane = new KlyxProviderControlPlane([registration()]);

    const result = await executeWithKlyxProviderControlPlane({
      controlPlane,
      adapter,
      operation: {
        capability: "llm",
        operation: "generate",
        kind: "read",
        retrySafety: "read_only",
      },
      payload: "hello",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "ADAPTER_CAPABILITY_NOT_SUPPORTED",
      attempts: 0,
      requiresReconciliation: false,
    });
    expect(calls).toBe(0);
  });

  it("preserves reconciliation-required when an unknown mutation outcome opens the circuit before retry", async () => {
    let calls = 0;
    const adapter: KlyxProviderExecutionAdapter<string, string> = {
      provider: "openai",
      capabilities: ["llm"],
      async execute() {
        calls += 1;
        throw new KlyxProviderExecutionError({
          code: "TIMEOUT",
          message: "provider outcome is unknown",
          retryable: true,
          certainty: "unknown",
        });
      },
    };
    const controlPlane = new KlyxProviderControlPlane([
      registration({
        retry: {
          maxAttempts: 2,
          baseDelayMs: 0,
          maxDelayMs: 0,
          retryableCodes: ["TIMEOUT"],
        },
        circuitBreaker: {
          failureThreshold: 1,
          openMs: 10_000,
          halfOpenMaxCalls: 1,
        },
      }),
    ]);

    const result = await executeWithKlyxProviderControlPlane({
      controlPlane,
      adapter,
      operation: {
        capability: "llm",
        operation: "mutate",
        kind: "mutation",
        retrySafety: "provider_idempotent",
        idempotencyKey: "stable-idempotency-key",
      },
      payload: "mutation",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "CIRCUIT_OPEN",
      attempts: 1,
      requiresReconciliation: true,
    });
    expect(calls).toBe(1);
  });

  it("audits recovery from degraded health to healthy", () => {
    const audit: KlyxProviderAuditEvent[] = [];
    const controlPlane = new KlyxProviderControlPlane(
      [
        registration({
          health: {
            degradedAfterConsecutiveFailures: 1,
            unhealthyAfterConsecutiveFailures: 2,
            blockWhenUnhealthy: false,
          },
        }),
      ],
      { audit: (event) => audit.push(event) }
    );

    const failed = controlPlane.admit(readOperation);
    expect(failed.allowed).toBe(true);
    if (!failed.allowed) {
      throw new Error("expected failure probe to be admitted");
    }
    controlPlane.recordAttempt(failed.permit, {
      ok: false,
      code: "UPSTREAM_5XX",
      certainty: "known_failed",
    });
    expect(controlPlane.snapshot("openai").health).toBe("degraded");

    const recovered = controlPlane.admit(readOperation);
    expect(recovered.allowed).toBe(true);
    if (!recovered.allowed) {
      throw new Error("expected recovery probe to be admitted");
    }
    controlPlane.recordAttempt(recovered.permit, {
      ok: true,
      code: "OK",
    });

    expect(controlPlane.snapshot("openai").health).toBe("healthy");
    expect(
      audit.some(
        (event) =>
          event.action === "health_changed" &&
          event.details?.health === "healthy"
      )
    ).toBe(true);
  });
});
