import type { KlyxExternalProviderName } from "./contracts";
import {
  KlyxProviderExecutionError,
  type KlyxProviderAdmission,
  type KlyxProviderAttemptResult,
  type KlyxProviderAuditEvent,
  type KlyxProviderControlPlaneDependencies,
  type KlyxProviderControlPlaneRegistration,
  type KlyxProviderExecutionAdapter,
  type KlyxProviderFallbackPolicy,
  type KlyxProviderHealthState,
  type KlyxProviderMetric,
  type KlyxProviderOperation,
  type KlyxProviderPermit,
  type KlyxProviderStateSnapshot,
} from "./control-plane-contracts";

type WindowCounter = {
  startedAtMs: number;
  used: number;
};

type ProviderMutableState = {
  health: KlyxProviderHealthState;
  consecutiveFailures: number;
  quota: WindowCounter;
  budget: WindowCounter;
  rateLimit: WindowCounter;
  circuit: "closed" | "open" | "half_open";
  circuitFailures: number;
  circuitOpenedAtMs: number | null;
  halfOpenInFlight: number;
  budgetWarningEmitted: boolean;
};

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function validateRegistration(
  registration: KlyxProviderControlPlaneRegistration
): void {
  const { policy } = registration;

  if (registration.capabilities.length === 0) {
    throw new Error(`${registration.provider} must declare at least one capability`);
  }

  if (policy.timeoutMs !== null) {
    assertPositiveInteger(policy.timeoutMs, `${registration.provider}.timeoutMs`);
  }

  assertPositiveInteger(
    policy.retry.maxAttempts,
    `${registration.provider}.retry.maxAttempts`
  );
  if (policy.retry.baseDelayMs < 0 || policy.retry.maxDelayMs < 0) {
    throw new Error(`${registration.provider}.retry delays must be >= 0`);
  }
  if (policy.retry.baseDelayMs > policy.retry.maxDelayMs) {
    throw new Error(
      `${registration.provider}.retry baseDelayMs must be <= maxDelayMs`
    );
  }

  for (const [label, limit] of [
    ["quota", policy.quota],
    ["rateLimit", policy.rateLimit],
  ] as const) {
    if (limit) {
      assertPositiveInteger(
        limit.max,
        `${registration.provider}.${label}.max`
      );
      assertPositiveInteger(
        limit.windowMs,
        `${registration.provider}.${label}.windowMs`
      );
    }
  }

  if (policy.budget) {
    assertPositiveInteger(
      policy.budget.maxMinor,
      `${registration.provider}.budget.maxMinor`
    );
    assertPositiveInteger(
      policy.budget.windowMs,
      `${registration.provider}.budget.windowMs`
    );
    if (!policy.budget.currency.trim()) {
      throw new Error(`${registration.provider}.budget.currency is required`);
    }
    if (
      policy.budget.warnAtBps !== undefined &&
      (policy.budget.warnAtBps <= 0 || policy.budget.warnAtBps > 10_000)
    ) {
      throw new Error(
        `${registration.provider}.budget.warnAtBps must be within 1..10000`
      );
    }
  }

  if (policy.circuitBreaker) {
    assertPositiveInteger(
      policy.circuitBreaker.failureThreshold,
      `${registration.provider}.circuitBreaker.failureThreshold`
    );
    assertPositiveInteger(
      policy.circuitBreaker.openMs,
      `${registration.provider}.circuitBreaker.openMs`
    );
    assertPositiveInteger(
      policy.circuitBreaker.halfOpenMaxCalls,
      `${registration.provider}.circuitBreaker.halfOpenMaxCalls`
    );
  }

  assertPositiveInteger(
    policy.health.degradedAfterConsecutiveFailures,
    `${registration.provider}.health.degradedAfterConsecutiveFailures`
  );
  assertPositiveInteger(
    policy.health.unhealthyAfterConsecutiveFailures,
    `${registration.provider}.health.unhealthyAfterConsecutiveFailures`
  );
  if (
    policy.health.degradedAfterConsecutiveFailures >
    policy.health.unhealthyAfterConsecutiveFailures
  ) {
    throw new Error(
      `${registration.provider}.health degraded threshold must be <= unhealthy threshold`
    );
  }
}

export class KlyxProviderControlPlane {
  private readonly registrations = new Map<
    KlyxExternalProviderName,
    KlyxProviderControlPlaneRegistration
  >();
  private readonly states = new Map<
    KlyxExternalProviderName,
    ProviderMutableState
  >();
  private readonly now: () => number;
  private readonly nextId: () => string;
  private readonly auditSink: (event: KlyxProviderAuditEvent) => void;
  private readonly observeSink: (metric: KlyxProviderMetric) => void;

  constructor(
    registrations: readonly KlyxProviderControlPlaneRegistration[],
    dependencies: KlyxProviderControlPlaneDependencies = {}
  ) {
    let sequence = 0;
    this.now = dependencies.now ?? (() => Date.now());
    this.nextId =
      dependencies.nextId ?? (() => `provider-event-${++sequence}`);
    this.auditSink = dependencies.audit ?? (() => undefined);
    this.observeSink = dependencies.observe ?? (() => undefined);

    const now = this.now();
    for (const registration of registrations) {
      validateRegistration(registration);
      if (this.registrations.has(registration.provider)) {
        throw new Error(
          `duplicate provider registration: ${registration.provider}`
        );
      }
      this.registrations.set(registration.provider, registration);
      this.states.set(registration.provider, {
        health: "unknown",
        consecutiveFailures: 0,
        quota: { startedAtMs: now, used: 0 },
        budget: { startedAtMs: now, used: 0 },
        rateLimit: { startedAtMs: now, used: 0 },
        circuit: "closed",
        circuitFailures: 0,
        circuitOpenedAtMs: null,
        halfOpenInFlight: 0,
        budgetWarningEmitted: false,
      });
    }
  }

  getRegistration(
    provider: KlyxExternalProviderName
  ): KlyxProviderControlPlaneRegistration {
    const registration = this.registrations.get(provider);
    if (!registration) {
      throw new Error(`provider is not registered: ${provider}`);
    }
    return registration;
  }

  getFallback(
    provider: KlyxExternalProviderName
  ): KlyxProviderFallbackPolicy {
    return this.getRegistration(provider).policy.fallback;
  }

  listRegistrations(): readonly KlyxProviderControlPlaneRegistration[] {
    return [...this.registrations.values()];
  }

  admit(operation: KlyxProviderOperation): KlyxProviderAdmission {
    const now = this.now();
    const registration = this.getRegistration(operation.provider);
    const state = this.getState(operation.provider);
    const { policy } = registration;

    this.resetExpiredWindows(registration, state, now);
    this.refreshCircuit(registration, state, now);

    if (!policy.enabled) {
      return this.block(
        operation,
        "PROVIDER_DISABLED",
        policy.fallback,
        now
      );
    }
    if (!registration.capabilities.includes(operation.capability)) {
      return this.block(
        operation,
        "CAPABILITY_NOT_SUPPORTED",
        policy.fallback,
        now
      );
    }
    if (
      policy.health.blockWhenUnhealthy &&
      state.health === "unhealthy"
    ) {
      return this.block(
        operation,
        "PROVIDER_UNHEALTHY",
        policy.fallback,
        now
      );
    }
    if (state.circuit === "open") {
      return this.block(operation, "CIRCUIT_OPEN", policy.fallback, now);
    }
    if (
      state.circuit === "half_open" &&
      policy.circuitBreaker &&
      state.halfOpenInFlight >= policy.circuitBreaker.halfOpenMaxCalls
    ) {
      return this.block(
        operation,
        "CIRCUIT_HALF_OPEN_BUSY",
        policy.fallback,
        now
      );
    }
    if (
      policy.rateLimit &&
      state.rateLimit.used >= policy.rateLimit.max
    ) {
      return this.block(operation, "RATE_LIMITED", policy.fallback, now);
    }
    if (policy.quota && state.quota.used >= policy.quota.max) {
      return this.block(operation, "QUOTA_EXCEEDED", policy.fallback, now);
    }

    if (policy.budget && operation.estimatedCostMinor !== undefined) {
      if (
        operation.costCurrency &&
        operation.costCurrency.toUpperCase() !==
          policy.budget.currency.toUpperCase()
      ) {
        return this.block(
          operation,
          "BUDGET_CURRENCY_MISMATCH",
          policy.fallback,
          now
        );
      }
      if (
        state.budget.used + operation.estimatedCostMinor >
        policy.budget.maxMinor
      ) {
        return this.block(
          operation,
          "BUDGET_EXCEEDED",
          policy.fallback,
          now
        );
      }
    }

    state.rateLimit.used += 1;
    state.quota.used += 1;
    if (state.circuit === "half_open") {
      state.halfOpenInFlight += 1;
    }

    const permit: KlyxProviderPermit = {
      attemptId: this.nextId(),
      admittedAtMs: now,
      provider: operation.provider,
      capability: operation.capability,
      operation: operation.operation,
      timeoutMs: policy.timeoutMs,
    };

    this.audit({
      eventId: this.nextId(),
      occurredAtMs: now,
      provider: operation.provider,
      capability: operation.capability,
      operation: operation.operation,
      action: "admitted",
      details: { attemptId: permit.attemptId },
    });
    this.observe({
      name: "provider_control_plane_admission_total",
      value: 1,
      occurredAtMs: now,
      provider: operation.provider,
      labels: { capability: operation.capability },
    });

    return { allowed: true, permit };
  }

  recordAttempt(
    permit: KlyxProviderPermit,
    result: KlyxProviderAttemptResult
  ): void {
    const now = this.now();
    const registration = this.getRegistration(permit.provider);
    const state = this.getState(permit.provider);

    if (state.circuit === "half_open" && state.halfOpenInFlight > 0) {
      state.halfOpenInFlight -= 1;
    }

    this.consumeBudget(registration, state, result, now);

    if (result.ok) {
      state.consecutiveFailures = 0;
      state.health = "healthy";
      state.circuitFailures = 0;
      if (state.circuit !== "closed") {
        state.circuit = "closed";
        state.circuitOpenedAtMs = null;
        this.auditCircuit(permit, "circuit_closed", now);
      }

      this.audit({
        eventId: this.nextId(),
        occurredAtMs: now,
        provider: permit.provider,
        capability: permit.capability,
        operation: permit.operation,
        action: "attempt_succeeded",
        reasonCode: result.code,
        details: { attemptId: permit.attemptId },
      });
      this.observeResult(permit, "success", now);
      return;
    }

    state.consecutiveFailures += 1;
    this.updateHealthFromFailures(registration, state, permit, now);

    if (
      result.countsTowardCircuit !== false &&
      registration.policy.circuitBreaker
    ) {
      state.circuitFailures += 1;
      if (
        state.circuitFailures >=
        registration.policy.circuitBreaker.failureThreshold
      ) {
        state.circuit = "open";
        state.circuitOpenedAtMs = now;
        state.halfOpenInFlight = 0;
        this.auditCircuit(
          permit,
          "circuit_opened",
          now,
          result.code
        );
      }
    }

    this.audit({
      eventId: this.nextId(),
      occurredAtMs: now,
      provider: permit.provider,
      capability: permit.capability,
      operation: permit.operation,
      action: "attempt_failed",
      reasonCode: result.code,
      details: {
        attemptId: permit.attemptId,
        certainty: result.certainty ?? "unknown",
        retryable: result.retryable ?? false,
      },
    });
    this.observeResult(permit, "failure", now, result.code);
  }

  setHealth(
    provider: KlyxExternalProviderName,
    health: KlyxProviderHealthState,
    reasonCode: string
  ): void {
    const state = this.getState(provider);
    if (state.health === health) {
      return;
    }
    state.health = health;
    this.audit({
      eventId: this.nextId(),
      occurredAtMs: this.now(),
      provider,
      action: "health_changed",
      reasonCode,
      details: { health },
    });
  }

  snapshot(
    provider: KlyxExternalProviderName
  ): KlyxProviderStateSnapshot {
    const registration = this.getRegistration(provider);
    const state = this.getState(provider);
    const now = this.now();
    this.resetExpiredWindows(registration, state, now);
    this.refreshCircuit(registration, state, now);

    return {
      provider,
      health: state.health,
      consecutiveFailures: state.consecutiveFailures,
      quotaUsed: state.quota.used,
      budgetUsedMinor: state.budget.used,
      rateLimitUsed: state.rateLimit.used,
      circuit: state.circuit,
      circuitFailures: state.circuitFailures,
      circuitOpenedAtMs: state.circuitOpenedAtMs,
      halfOpenInFlight: state.halfOpenInFlight,
    };
  }

  private getState(
    provider: KlyxExternalProviderName
  ): ProviderMutableState {
    const state = this.states.get(provider);
    if (!state) {
      throw new Error(`provider state is not registered: ${provider}`);
    }
    return state;
  }

  private block(
    operation: KlyxProviderOperation,
    reason: Exclude<
      KlyxProviderAdmission,
      { allowed: true }
    >["reason"],
    fallback: KlyxProviderFallbackPolicy,
    now: number
  ): KlyxProviderAdmission {
    this.audit({
      eventId: this.nextId(),
      occurredAtMs: now,
      provider: operation.provider,
      capability: operation.capability,
      operation: operation.operation,
      action: "blocked",
      reasonCode: reason,
      details: { fallback: fallback.action },
    });
    this.observe({
      name: "provider_control_plane_block_total",
      value: 1,
      occurredAtMs: now,
      provider: operation.provider,
      labels: { reason },
    });
    return {
      allowed: false,
      provider: operation.provider,
      reason,
      fallback,
    };
  }

  private resetExpiredWindows(
    registration: KlyxProviderControlPlaneRegistration,
    state: ProviderMutableState,
    now: number
  ): void {
    const pairs: Array<[WindowCounter, number | null]> = [
      [state.quota, registration.policy.quota?.windowMs ?? null],
      [
        state.rateLimit,
        registration.policy.rateLimit?.windowMs ?? null,
      ],
      [state.budget, registration.policy.budget?.windowMs ?? null],
    ];

    for (const [counter, windowMs] of pairs) {
      if (
        windowMs !== null &&
        now - counter.startedAtMs >= windowMs
      ) {
        counter.startedAtMs = now;
        counter.used = 0;
      }
    }

    if (
      registration.policy.budget &&
      now - state.budget.startedAtMs <
        registration.policy.budget.windowMs &&
      state.budget.used === 0
    ) {
      state.budgetWarningEmitted = false;
    }
  }

  private refreshCircuit(
    registration: KlyxProviderControlPlaneRegistration,
    state: ProviderMutableState,
    now: number
  ): void {
    const circuit = registration.policy.circuitBreaker;
    if (
      circuit &&
      state.circuit === "open" &&
      state.circuitOpenedAtMs !== null &&
      now - state.circuitOpenedAtMs >= circuit.openMs
    ) {
      state.circuit = "half_open";
      state.halfOpenInFlight = 0;
      this.audit({
        eventId: this.nextId(),
        occurredAtMs: now,
        provider: registration.provider,
        action: "circuit_half_opened",
      });
    }
  }

  private updateHealthFromFailures(
    registration: KlyxProviderControlPlaneRegistration,
    state: ProviderMutableState,
    permit: KlyxProviderPermit,
    now: number
  ): void {
    const previous = state.health;
    const healthPolicy = registration.policy.health;

    if (
      state.consecutiveFailures >=
      healthPolicy.unhealthyAfterConsecutiveFailures
    ) {
      state.health = "unhealthy";
    } else if (
      state.consecutiveFailures >=
      healthPolicy.degradedAfterConsecutiveFailures
    ) {
      state.health = "degraded";
    }

    if (state.health !== previous) {
      this.audit({
        eventId: this.nextId(),
        occurredAtMs: now,
        provider: permit.provider,
        capability: permit.capability,
        operation: permit.operation,
        action: "health_changed",
        details: { health: state.health },
      });
    }
  }

  private consumeBudget(
    registration: KlyxProviderControlPlaneRegistration,
    state: ProviderMutableState,
    result: KlyxProviderAttemptResult,
    now: number
  ): void {
    const budget = registration.policy.budget;
    if (!budget || result.actualCostMinor === undefined) {
      return;
    }
    if (
      result.costCurrency &&
      result.costCurrency.toUpperCase() !== budget.currency.toUpperCase()
    ) {
      this.observe({
        name: "provider_control_plane_budget_currency_mismatch_total",
        value: 1,
        occurredAtMs: now,
        provider: registration.provider,
      });
      return;
    }

    state.budget.used += Math.max(0, result.actualCostMinor);
    this.observe({
      name: "provider_control_plane_budget_used_minor",
      value: state.budget.used,
      occurredAtMs: now,
      provider: registration.provider,
      labels: { currency: budget.currency.toUpperCase() },
    });

    const warnAtBps = budget.warnAtBps;
    if (
      warnAtBps &&
      !state.budgetWarningEmitted &&
      state.budget.used * 10_000 >= budget.maxMinor * warnAtBps
    ) {
      state.budgetWarningEmitted = true;
      this.audit({
        eventId: this.nextId(),
        occurredAtMs: now,
        provider: registration.provider,
        action: "budget_threshold_reached",
        details: {
          budgetUsedMinor: state.budget.used,
          budgetMaxMinor: budget.maxMinor,
          warnAtBps,
        },
      });
    }
  }

  private auditCircuit(
    permit: KlyxProviderPermit,
    action: "circuit_opened" | "circuit_closed",
    now: number,
    reasonCode?: string
  ): void {
    this.audit({
      eventId: this.nextId(),
      occurredAtMs: now,
      provider: permit.provider,
      capability: permit.capability,
      operation: permit.operation,
      action,
      reasonCode,
    });
  }

  private observeResult(
    permit: KlyxProviderPermit,
    outcome: "success" | "failure",
    now: number,
    code?: string
  ): void {
    this.observe({
      name: "provider_control_plane_attempt_total",
      value: 1,
      occurredAtMs: now,
      provider: permit.provider,
      labels: {
        capability: permit.capability,
        outcome,
        ...(code ? { code } : {}),
      },
    });
  }

  private audit(event: KlyxProviderAuditEvent): void {
    this.auditSink(event);
  }

  private observe(metric: KlyxProviderMetric): void {
    this.observeSink(metric);
  }
}

export type KlyxProviderExecutionOutcome<TOutput> =
  | {
      readonly ok: true;
      readonly value: TOutput;
      readonly attempts: number;
      readonly provider: KlyxExternalProviderName;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly attempts: number;
      readonly provider: KlyxExternalProviderName;
      readonly fallback: KlyxProviderFallbackPolicy;
      readonly requiresReconciliation: boolean;
    };

export async function executeWithKlyxProviderControlPlane<
  TInput,
  TOutput
>(input: {
  readonly controlPlane: KlyxProviderControlPlane;
  readonly adapter: KlyxProviderExecutionAdapter<TInput, TOutput>;
  readonly operation: Omit<KlyxProviderOperation, "provider">;
  readonly payload: TInput;
  readonly actualCost?: (
    value: TOutput
  ) => { minor: number; currency: string } | undefined;
  readonly sleep?: (ms: number) => Promise<void>;
}): Promise<KlyxProviderExecutionOutcome<TOutput>> {
  const { controlPlane, adapter, operation, payload } = input;
  const registration = controlPlane.getRegistration(adapter.provider);
  const retryPolicy = registration.policy.retry;
  const sleep =
    input.sleep ??
    ((ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms)));
  let attempts = 0;
  let lastCode = "PROVIDER_EXECUTION_FAILED";
  let lastCertainty: "known_failed" | "unknown" = "unknown";

  while (attempts < retryPolicy.maxAttempts) {
    attempts += 1;
    const admission = controlPlane.admit({
      provider: adapter.provider,
      ...operation,
    });

    if (!admission.allowed) {
      return {
        ok: false,
        code: admission.reason,
        attempts: attempts - 1,
        provider: adapter.provider,
        fallback: admission.fallback,
        requiresReconciliation: false,
      };
    }

    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
      const execution = adapter.execute({
        capability: operation.capability,
        operation: operation.operation,
        kind: operation.kind,
        retrySafety: operation.retrySafety,
        idempotencyKey: operation.idempotencyKey,
        input: payload,
        signal: controller.signal,
      });

      const timeoutMs = admission.permit.timeoutMs;
      const value =
        timeoutMs === null
          ? await execution
          : await Promise.race([
              execution,
              new Promise<never>((_, reject) => {
                timeoutHandle = setTimeout(() => {
                  controller.abort();
                  reject(
                    new KlyxProviderExecutionError({
                      code: "TIMEOUT",
                      message: `provider attempt timed out after ${timeoutMs}ms`,
                      retryable: true,
                      certainty: "unknown",
                    })
                  );
                }, timeoutMs);
              }),
            ]);

      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }

      const cost = input.actualCost?.(value);
      controlPlane.recordAttempt(admission.permit, {
        ok: true,
        code: "OK",
        actualCostMinor: cost?.minor,
        costCurrency: cost?.currency,
      });
      return {
        ok: true,
        value,
        attempts,
        provider: adapter.provider,
      };
    } catch (error) {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
      const normalized =
        error instanceof KlyxProviderExecutionError
          ? error
          : new KlyxProviderExecutionError({
              code: "PROVIDER_ERROR",
              message:
                error instanceof Error
                  ? error.message
                  : "provider execution failed",
              retryable: false,
              certainty: "unknown",
            });

      lastCode = normalized.code;
      lastCertainty = normalized.certainty;
      controlPlane.recordAttempt(admission.permit, {
        ok: false,
        code: normalized.code,
        retryable: normalized.retryable,
        certainty: normalized.certainty,
        countsTowardCircuit: normalized.countsTowardCircuit,
      });

      if (
        !canRetry(
          operation,
          normalized,
          attempts,
          retryPolicy.maxAttempts,
          retryPolicy.retryableCodes
        )
      ) {
        break;
      }

      const delayMs = Math.min(
        retryPolicy.maxDelayMs,
        retryPolicy.baseDelayMs * 2 ** Math.max(0, attempts - 1)
      );
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  return {
    ok: false,
    code: lastCode,
    attempts,
    provider: adapter.provider,
    fallback: controlPlane.getFallback(adapter.provider),
    requiresReconciliation:
      operation.kind === "mutation" && lastCertainty === "unknown",
  };
}

function canRetry(
  operation: Omit<KlyxProviderOperation, "provider">,
  error: KlyxProviderExecutionError,
  attempts: number,
  maxAttempts: number,
  retryableCodes: readonly string[]
): boolean {
  if (
    attempts >= maxAttempts ||
    !error.retryable ||
    !retryableCodes.includes(error.code)
  ) {
    return false;
  }

  if (operation.kind === "read") {
    return operation.retrySafety !== "unsafe";
  }

  return (
    operation.retrySafety === "provider_idempotent" &&
    Boolean(operation.idempotencyKey?.trim())
  );
}
