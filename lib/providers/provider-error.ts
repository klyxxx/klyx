import type { KlyxProviderId } from "./contracts";

export type KlyxProviderErrorOptions = {
  provider: KlyxProviderId;
  operation: string;
  code: string;
  retryable: boolean;
  externalStateUnknown?: boolean;
  cause?: unknown;
};

export class KlyxProviderError extends Error {
  readonly provider: KlyxProviderId;
  readonly operation: string;
  readonly code: string;
  readonly retryable: boolean;
  readonly externalStateUnknown: boolean;

  constructor(message: string, options: KlyxProviderErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "KlyxProviderError";
    this.provider = options.provider;
    this.operation = options.operation;
    this.code = options.code;
    this.retryable = options.retryable;
    this.externalStateUnknown = options.externalStateUnknown ?? false;
  }
}

export function asKlyxProviderError(
  error: unknown,
  options: Omit<KlyxProviderErrorOptions, "cause"> & { fallbackMessage: string }
): KlyxProviderError {
  if (error instanceof KlyxProviderError) {
    return error;
  }

  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : options.fallbackMessage;

  return new KlyxProviderError(message, {
    provider: options.provider,
    operation: options.operation,
    code: options.code,
    retryable: options.retryable,
    externalStateUnknown: options.externalStateUnknown,
    cause: error,
  });
}
