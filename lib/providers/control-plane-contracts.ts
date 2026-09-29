import type { KlyxExternalProviderName } from "./contracts";

export type KlyxProviderOperationKind = "read" | "mutation";
export type KlyxProviderRetrySafety =
  | "read_only"
  | "provider_idempotent"
  | "unsafe";
export type KlyxProviderOutcomeCertainty = "known_failed" | "unknown";

export type KlyxProviderHealthState =
  | "unknown"
  | "healthy"
  | "degraded"
  | "unhealthy";

export type KlyxProviderCircuitState = "closed" | "open" | "half_open";

export type KlyxProviderFallbackAction =
  | "block"
  | "degrade"
  | "continue_without_provider"
  | "human_review"
  | "stop_control_plane";

export type KlyxProviderBlockReason =
  | "PROVIDER_DISABLED"
  | "CAPABILITY_NOT_SUPPORTED"
  | "PROVIDER_UNHEALTHY"
  | "QUOTA_EXCEEDED"
  | "BUDGET_EXCEEDED"
  | "BUDGET_CURRENCY_MISMATCH"
  | "RATE_LIMITED"
  | "CIRCUIT_OPEN"
  | "CIRCUIT_HALF_OPEN_BUSY";

export type KlyxProviderWindowLimit = {
  readonly max: number;
  readonly windowMs: number;
};

export type KlyxProviderBudgetPolicy = {
  readonly currency: string;
  readonly maxMinor: number;
  readonly windowMs: number;
  readonly warnAtBps?: number;
};

export type KlyxProviderRetryPolicy = {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly retryableCodes: readonly string[];
};

export type KlyxProviderCircuitBreakerPolicy = {
  readonly failureThreshold: number;
  readonly openMs: number;
  readonly halfOpenMaxCalls: number;
};

export type KlyxProviderHealthPolicy = {
  readonly degradedAfterConsecutiveFailures: number;
  readonly unhealthyAfterConsecutiveFailures: number;
  readonly blockWhenUnhealthy: boolean;
};

export type KlyxProviderFallbackPolicy = {
  readonly action: KlyxProviderFallbackAction;
  readonly reason: string;
};

export type KlyxProviderControlPlanePolicy = {
  readonly enabled: boolean;
  readonly quota: KlyxProviderWindowLimit | null;
  readonly budget: KlyxProviderBudgetPolicy | null;
  readonly rateLimit: KlyxProviderWindowLimit | null;
  readonly timeoutMs: number | null;
  readonly retry: KlyxProviderRetryPolicy;
  readonly fallback: KlyxProviderFallbackPolicy;
  readonly circuitBreaker: KlyxProviderCircuitBreakerPolicy | null;
  readonly health: KlyxProviderHealthPolicy;
};

export type KlyxProviderControlPlaneRegistration = {
  readonly provider: KlyxExternalProviderName;
  readonly capabilities: readonly string[];
  readonly authorityBoundary: string;
  readonly policy: KlyxProviderControlPlanePolicy;
};

export type KlyxProviderOperation = {
  readonly provider: KlyxExternalProviderName;
  readonly capability: string;
  readonly operation: string;
  readonly kind: KlyxProviderOperationKind;
  readonly retrySafety: KlyxProviderRetrySafety;
  readonly idempotencyKey?: string;
  readonly estimatedCostMinor?: number;
  readonly costCurrency?: string;
};

export type KlyxProviderPermit = {
  readonly attemptId: string;
  readonly admittedAtMs: number;
  readonly provider: KlyxExternalProviderName;
  readonly capability: string;
  readonly operation: string;
  readonly timeoutMs: number | null;
};

export type KlyxProviderAdmission =
  | { readonly allowed: true; readonly permit: KlyxProviderPermit }
  | {
      readonly allowed: false;
      readonly provider: KlyxExternalProviderName;
      readonly reason: KlyxProviderBlockReason;
      readonly fallback: KlyxProviderFallbackPolicy;
    };

export type KlyxProviderAttemptResult = {
  readonly ok: boolean;
  readonly code: string;
  readonly certainty?: KlyxProviderOutcomeCertainty;
  readonly retryable?: boolean;
  readonly countsTowardCircuit?: boolean;
  readonly actualCostMinor?: number;
  readonly costCurrency?: string;
};

export type KlyxProviderAuditEvent = {
  readonly eventId: string;
  readonly occurredAtMs: number;
  readonly provider: KlyxExternalProviderName;
  readonly capability?: string;
  readonly operation?: string;
  readonly action:
    | "admitted"
    | "blocked"
    | "attempt_succeeded"
    | "attempt_failed"
    | "health_changed"
    | "circuit_opened"
    | "circuit_half_opened"
    | "circuit_closed"
    | "budget_threshold_reached";
  readonly reasonCode?: string;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
};

export type KlyxProviderMetric = {
  readonly name: string;
  readonly value: number;
  readonly occurredAtMs: number;
  readonly provider: KlyxExternalProviderName;
  readonly labels?: Readonly<Record<string, string>>;
};

export type KlyxProviderControlPlaneDependencies = {
  readonly now?: () => number;
  readonly nextId?: () => string;
  readonly audit?: (event: KlyxProviderAuditEvent) => void;
  readonly observe?: (metric: KlyxProviderMetric) => void;
};

export type KlyxProviderStateSnapshot = {
  readonly provider: KlyxExternalProviderName;
  readonly health: KlyxProviderHealthState;
  readonly consecutiveFailures: number;
  readonly quotaUsed: number;
  readonly budgetUsedMinor: number;
  readonly rateLimitUsed: number;
  readonly circuit: KlyxProviderCircuitState;
  readonly circuitFailures: number;
  readonly circuitOpenedAtMs: number | null;
  readonly halfOpenInFlight: number;
};

export type KlyxProviderExecutionRequest<TInput> = {
  readonly capability: string;
  readonly operation: string;
  readonly kind: KlyxProviderOperationKind;
  readonly retrySafety: KlyxProviderRetrySafety;
  readonly idempotencyKey?: string;
  readonly input: TInput;
  readonly signal: AbortSignal;
};

export interface KlyxProviderExecutionAdapter<TInput = unknown, TOutput = unknown> {
  readonly provider: KlyxExternalProviderName;
  readonly capabilities: readonly string[];
  execute(request: KlyxProviderExecutionRequest<TInput>): Promise<TOutput>;
}

export class KlyxProviderExecutionError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly certainty: KlyxProviderOutcomeCertainty;
  readonly countsTowardCircuit: boolean;

  constructor(input: {
    code: string;
    message: string;
    retryable?: boolean;
    certainty?: KlyxProviderOutcomeCertainty;
    countsTowardCircuit?: boolean;
  }) {
    super(input.message);
    this.name = "KlyxProviderExecutionError";
    this.code = input.code;
    this.retryable = input.retryable ?? false;
    this.certainty = input.certainty ?? "unknown";
    this.countsTowardCircuit = input.countsTowardCircuit ?? true;
  }
}
