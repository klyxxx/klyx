import { describe, expect, it } from "vitest";

import {
  KlyxProviderControlPlane,
  executeWithKlyxProviderControlPlane,
} from "@/lib/providers/control-plane";
import {
  KlyxProviderExecutionError,
  type KlyxProviderAuditEvent,
  type KlyxProviderExecutionAdapter,
  type KlyxProviderMetric,
} from "@/lib/providers/control-plane-contracts";
import {
  createKlyxProviderControlPlanePolicy,
  createKlyxProviderControlPlaneRegistry,
} from "@/lib/providers/control-plane-registry";
import { KLYX_EXTERNAL_PROVIDER_NAMES } from "@/lib/providers/contracts";

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

const operation = {
  capability: "llm",
  operation: "generate",
  kind: "read" as const,
  retrySafety: "read_only" as const,
};

describe("Provider Control Plane Foundation", () => {
  it("registers every canonical provider without silently activating enforcement", () => {
    const registry = createKlyxProviderControlPlaneRegistry();

    expect(registry.map((entry) => entry.provider).sort()).toEqual(
      [...KLYX_EXTERNAL_PROVIDER_NAMES].sort()
    );
    for (const entry of registry) {
      expect(entry.policy.enabled).toBe(true);
      expect(entry.policy.quota).toBeNull();
      expect(entry.policy.budget).toBeNull();
      expect(entry.policy.rateLimit).toBeNull();
      expect(entry.policy.timeoutMs).toBeNull();
      expect(entry.policy.retry.maxAttempts).toBe(1);
      expect(entry.policy.circuitBreaker).toBeNull();
    }
  });

  it("keeps sensitive providers fail-closed and non-authoritative providers degradable", () => {
    const registry = createKlyxProviderControlPlaneRegistry();
    const byProvider = Object.fromEntries(
      registry.map((entry) => [entry.provider, entry])
    );

    expect(byProvider.stripe.policy.fallback.action).toBe("block");
    expect(byProvider.supabase.policy.fallback.action).toBe("block");
    expect(byProvider.cloudflare_turnstile.policy.fallback.action).toBe(
      "block"
    );
    expect(byProvider.sumsub.policy.fallback.action).toBe("human_review");
    expect(byProvider.openai.policy.fallback.action).toBe("degrade");
    expect(byProvider.elmah_io.policy.fallback.action).toBe(
      "continue_without_provider"
    );
    expect(byProvider.github.policy.fallback.action).toBe(
      "stop_control_plane"
    );
  });

  it("enforces rate limit, quota and budget before external execution", () => {
    let now = 1_000;
    const controlPlane = new KlyxProviderControlPlane(
      [
        registration({
          rateLimit: { max: 2, windowMs: 1_000 },
          quota: { max: 3, windowMs: 10_000 },
          budget: {
            currency: "USD",
            maxMinor: 100,
            windowMs: 60_000,
          },
        }),
      ],
      { now: () => now }
    );

    const first = controlPlane.admit({
      provider: "openai",
      ...operation,
      estimatedCostMinor: 60,
      costCurrency: "USD",
    });
    expect(first.allowed).toBe(true);
    if (first.allowed) {
      controlPlane.recordAttempt(first.permit, {
        ok: true,
        code: "OK",
        actualCostMinor: 60,
        costCurrency: "USD",
      });
    }

    const second = controlPlane.admit({
      provider: "openai",
      ...operation,
      estimatedCostMinor: 50,
      costCurrency: "USD",
    });
    expect(second).toMatchObject({
      allowed: false,
      reason: "BUDGET_EXCEEDED",
    });

    const cheap = controlPlane.admit({
      provider: "openai",
      ...operation,
    });
    expect(cheap.allowed).toBe(true);
    const rateLimited = controlPlane.admit({
      provider: "openai",
      ...operation,
    });
    expect(rateLimited).toMatchObject({
      allowed: false,
      reason: "RATE_LIMITED",
    });

    now += 1_000;
    const afterRateWindow = controlPlane.admit({
      provider: "openai",
      ...operation,
    });
    expect(afterRateWindow).toMatchObject({
      allowed: false,
      reason: "QUOTA_EXCEEDED",
    });
  });

  it("opens, half-opens and closes a circuit breaker deterministically", () => {
    let now = 10_000;
    const controlPlane = new KlyxProviderControlPlane(
      [
        registration({
          circuitBreaker: {
            failureThreshold: 2,
            openMs: 5_000,
            halfOpenMaxCalls: 1,
          },
        }),
      ],
      { now: () => now }
    );

    for (let index = 0; index < 2; index += 1) {
      const admission = controlPlane.admit({
        provider: "openai",
        ...operation,
      });
      expect(admission.allowed).toBe(true);
      if (admission.allowed) {
        controlPlane.recordAttempt(admission.permit, {
          ok: false,
          code: "UPSTREAM_5XX",
          retryable: true,
          certainty: "known_failed",
        });
      }
    }

    expect(controlPlane.snapshot("openai").circuit).toBe("open");
    expect(
      controlPlane.admit({ provider: "openai", ...operation })
    ).toMatchObject({
      allowed: false,
      reason: "CIRCUIT_OPEN",
    });

    now += 5_000;
    const probe = controlPlane.admit({
      provider: "openai",
      ...operation,
    });
    expect(probe.allowed).toBe(true);
    expect(controlPlane.snapshot("openai").circuit).toBe("half_open");
    expect(
      controlPlane.admit({ provider: "openai", ...operation })
    ).toMatchObject({
      allowed: false,
      reason: "CIRCUIT_HALF_OPEN_BUSY",
    });

    if (probe.allowed) {
      controlPlane.recordAttempt(probe.permit, {
        ok: true,
        code: "OK",
      });
    }
    expect(controlPlane.snapshot("openai").circuit).toBe("closed");
  });

  it("retries a retryable read but never retries an unsafe mutation", async () => {
    const policy = {
      retry: {
        maxAttempts: 3,
        baseDelayMs: 0,
        maxDelayMs: 0,
        retryableCodes: ["UPSTREAM_5XX"],
      },
    };

    let readCalls = 0;
    const readAdapter: KlyxProviderExecutionAdapter<string, string> = {
      provider: "openai",
      capabilities: ["llm"],
      async execute() {
        readCalls += 1;
        if (readCalls === 1) {
          throw new KlyxProviderExecutionError({
            code: "UPSTREAM_5XX",
            message: "temporary",
            retryable: true,
            certainty: "known_failed",
          });
        }
        return "ok";
      },
    };

    const readControlPlane = new KlyxProviderControlPlane([
      registration(policy),
    ]);
    const readResult = await executeWithKlyxProviderControlPlane({
      controlPlane: readControlPlane,
      adapter: readAdapter,
      operation,
      payload: "hello",
    });
    expect(readResult).toMatchObject({ ok: true, attempts: 2 });
    expect(readCalls).toBe(2);

    let mutationCalls = 0;
    const mutationAdapter: KlyxProviderExecutionAdapter<string, string> = {
      ...readAdapter,
      async execute() {
        mutationCalls += 1;
        throw new KlyxProviderExecutionError({
          code: "UPSTREAM_5XX",
          message: "unknown mutation outcome",
          retryable: true,
          certainty: "unknown",
        });
      },
    };
    const mutationControlPlane = new KlyxProviderControlPlane([
      registration(policy),
    ]);
    const mutationResult = await executeWithKlyxProviderControlPlane({
      controlPlane: mutationControlPlane,
      adapter: mutationAdapter,
      operation: {
        ...operation,
        kind: "mutation",
        retrySafety: "unsafe",
      },
      payload: "hello",
    });

    expect(mutationResult).toMatchObject({
      ok: false,
      attempts: 1,
      requiresReconciliation: true,
    });
    expect(mutationCalls).toBe(1);
  });

  it("allows retry of a mutation only when provider idempotency is explicit and keyed", async () => {
    let calls = 0;
    const adapter: KlyxProviderExecutionAdapter<string, string> = {
      provider: "openai",
      capabilities: ["llm"],
      async execute() {
        calls += 1;
        if (calls === 1) {
          throw new KlyxProviderExecutionError({
            code: "TIMEOUT",
            message: "timeout",
            retryable: true,
            certainty: "unknown",
          });
        }
        return "ok";
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
      }),
    ]);

    const result = await executeWithKlyxProviderControlPlane({
      controlPlane,
      adapter,
      operation: {
        ...operation,
        kind: "mutation",
        retrySafety: "provider_idempotent",
        idempotencyKey: "stable-key",
      },
      payload: "hello",
    });

    expect(result).toMatchObject({ ok: true, attempts: 2 });
    expect(calls).toBe(2);
  });

  it("turns a bounded mutation timeout into reconciliation-required state", async () => {
    const adapter: KlyxProviderExecutionAdapter<string, string> = {
      provider: "openai",
      capabilities: ["llm"],
      async execute() {
        return new Promise<string>(() => undefined);
      },
    };
    const controlPlane = new KlyxProviderControlPlane([
      registration({ timeoutMs: 5 }),
    ]);

    const result = await executeWithKlyxProviderControlPlane({
      controlPlane,
      adapter,
      operation: {
        ...operation,
        kind: "mutation",
        retrySafety: "unsafe",
      },
      payload: "hello",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "TIMEOUT",
      attempts: 1,
      requiresReconciliation: true,
    });
  });

  it("emits audit and observability without copying provider payloads", () => {
    const audit: KlyxProviderAuditEvent[] = [];
    const metrics: KlyxProviderMetric[] = [];
    const controlPlane = new KlyxProviderControlPlane(
      [
        registration({
          budget: {
            currency: "USD",
            maxMinor: 100,
            windowMs: 60_000,
            warnAtBps: 5_000,
          },
        }),
      ],
      {
        audit: (event) => audit.push(event),
        observe: (metric) => metrics.push(metric),
      }
    );

    const admission = controlPlane.admit({
      provider: "openai",
      ...operation,
    });
    expect(admission.allowed).toBe(true);
    if (admission.allowed) {
      controlPlane.recordAttempt(admission.permit, {
        ok: true,
        code: "OK",
        actualCostMinor: 50,
        costCurrency: "USD",
      });
    }

    expect(
      audit.some((event) => event.action === "admitted")
    ).toBe(true);
    expect(
      audit.some((event) => event.action === "attempt_succeeded")
    ).toBe(true);
    expect(
      audit.some((event) => event.action === "budget_threshold_reached")
    ).toBe(true);
    expect(
      metrics.some(
        (metric) => metric.name === "provider_control_plane_attempt_total"
      )
    ).toBe(true);
    expect(JSON.stringify(audit)).not.toContain("hello");
  });
});
