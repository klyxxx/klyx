export type ProviderReplaySafety =
  | "safe"
  | "idempotent"
  | "ambiguous";

export type ProviderHttpRecoveryOptions = {
  provider: string;
  operation: string;
  replaySafety: ProviderReplaySafety;
  maxAttempts?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
  fetchImpl?: typeof fetch;
  sleepImpl?: (delayMs: number) => Promise<void>;
};

export class ProviderHttpRecoveryError extends Error {
  readonly provider: string;
  readonly operation: string;
  readonly reason:
    | "timeout_or_network"
    | "retry_exhausted";
  readonly ambiguous: boolean;
  readonly attempts: number;

  constructor(input: {
    provider: string;
    operation: string;
    reason: "timeout_or_network" | "retry_exhausted";
    ambiguous: boolean;
    attempts: number;
    cause?: unknown;
  }) {
    super(
      `${input.provider}:${input.operation}:${input.reason}`,
      input.cause === undefined ? undefined : { cause: input.cause }
    );
    this.name = "ProviderHttpRecoveryError";
    this.provider = input.provider;
    this.operation = input.operation;
    this.reason = input.reason;
    this.ambiguous = input.ambiguous;
    this.attempts = input.attempts;
  }
}

const RETRYABLE_STATUS = new Set([
  408,
  425,
  429,
  500,
  502,
  503,
  504,
]);

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 200;

function normalizedInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value as number)));
}

function canReplay(replaySafety: ProviderReplaySafety): boolean {
  return replaySafety === "safe" || replaySafety === "idempotent";
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function retryDelay(baseDelayMs: number, attempt: number): number {
  return Math.min(5_000, baseDelayMs * 2 ** Math.max(0, attempt - 1));
}

export async function fetchWithProviderRecovery(
  url: string | URL,
  init: RequestInit,
  options: ProviderHttpRecoveryOptions
): Promise<Response> {
  const timeoutMs = normalizedInteger(
    options.timeoutMs,
    DEFAULT_TIMEOUT_MS,
    250,
    30_000
  );
  const requestedAttempts = normalizedInteger(
    options.maxAttempts,
    DEFAULT_ATTEMPTS,
    1,
    5
  );
  const maxAttempts = canReplay(options.replaySafety)
    ? requestedAttempts
    : 1;
  const baseDelayMs = normalizedInteger(
    options.baseDelayMs,
    DEFAULT_BASE_DELAY_MS,
    0,
    5_000
  );
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? defaultSleep;

  let lastCause: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });

      if (
        !RETRYABLE_STATUS.has(response.status) ||
        attempt >= maxAttempts
      ) {
        if (
          RETRYABLE_STATUS.has(response.status) &&
          attempt >= maxAttempts &&
          maxAttempts > 1
        ) {
          throw new ProviderHttpRecoveryError({
            provider: options.provider,
            operation: options.operation,
            reason: "retry_exhausted",
            ambiguous: false,
            attempts: attempt,
          });
        }

        return response;
      }

      await sleepImpl(retryDelay(baseDelayMs, attempt));
    } catch (error) {
      if (error instanceof ProviderHttpRecoveryError) {
        throw error;
      }

      lastCause = error;

      if (!canReplay(options.replaySafety)) {
        throw new ProviderHttpRecoveryError({
          provider: options.provider,
          operation: options.operation,
          reason: "timeout_or_network",
          ambiguous: true,
          attempts: attempt,
          cause: error,
        });
      }

      if (attempt >= maxAttempts) {
        throw new ProviderHttpRecoveryError({
          provider: options.provider,
          operation: options.operation,
          reason: "retry_exhausted",
          ambiguous: false,
          attempts: attempt,
          cause: error,
        });
      }

      await sleepImpl(retryDelay(baseDelayMs, attempt));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new ProviderHttpRecoveryError({
    provider: options.provider,
    operation: options.operation,
    reason: "retry_exhausted",
    ambiguous: false,
    attempts: maxAttempts,
    cause: lastCause,
  });
}
