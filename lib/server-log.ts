// KLYX_PRODUCTION_LOGGING_12B_8A

type KlyxLogLevel =
  | "info"
  | "warn"
  | "error";

type KlyxServerLogInput = {
  event: string;
  route?: string;
  method?: string;
  status?: number;
  code?: string;
  durationMs?: number;
  requestId?: string;
};

type KlyxServerErrorInput =
  KlyxServerLogInput & {
    error?: unknown;
  };

const MAX_TEXT_LENGTH = 120;
const MAX_ERROR_IDENTIFIER_LENGTH = 80;

function sanitizeText(
  value: string | undefined
): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized =
    value
      .replace(/[\r\n\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TEXT_LENGTH);

  return normalized || undefined;
}

function safeInteger(
  value: number | undefined
): number | undefined {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return undefined;
  }

  return Math.max(
    0,
    Math.round(value)
  );
}

function safeErrorName(
  error: unknown
): string {
  if (error instanceof Error) {
    return (
      sanitizeText(error.name) ??
      "Error"
    );
  }

  return "UnknownError";
}

function safeErrorIdentifier(
  value: unknown
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length > MAX_ERROR_IDENTIFIER_LENGTH ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/.test(normalized)
  ) {
    return undefined;
  }

  return normalized;
}

function safeErrorMetadata(
  error: unknown
): {
  errorType?: string;
  errorCode?: string;
  errorParam?: string;
  errorStatusCode?: number;
} {
  if (!error || typeof error !== "object") {
    return {};
  }

  const candidate = error as {
    type?: unknown;
    code?: unknown;
    param?: unknown;
    statusCode?: unknown;
    raw?: {
      type?: unknown;
      code?: unknown;
      param?: unknown;
      statusCode?: unknown;
    };
  };

  const raw = candidate.raw;
  const statusCodeValue =
    typeof candidate.statusCode === "number"
      ? candidate.statusCode
      : typeof raw?.statusCode === "number"
        ? raw.statusCode
        : undefined;

  return {
    errorType:
      safeErrorIdentifier(candidate.type) ??
      safeErrorIdentifier(raw?.type),
    errorCode:
      safeErrorIdentifier(candidate.code) ??
      safeErrorIdentifier(raw?.code),
    errorParam:
      safeErrorIdentifier(candidate.param) ??
      safeErrorIdentifier(raw?.param),
    errorStatusCode:
      safeInteger(statusCodeValue),
  };
}

function createBaseRecord(
  level: KlyxLogLevel,
  input: KlyxServerLogInput
) {
  return {
    marker:
      "KLYX_SERVER_LOG_V1",
    timestamp:
      new Date().toISOString(),
    level,
    event:
      sanitizeText(input.event) ??
      "unknown_event",
    route:
      sanitizeText(input.route),
    method:
      sanitizeText(
        input.method?.toUpperCase()
      ),
    status:
      safeInteger(input.status),
    code:
      sanitizeText(input.code),
    durationMs:
      safeInteger(
        input.durationMs
      ),
    requestId:
      sanitizeText(
        input.requestId
      ),
  };
}

export function logServerInfo(
  input: KlyxServerLogInput
): void {
  console.info(
    JSON.stringify(
      createBaseRecord(
        "info",
        input
      )
    )
  );
}

export function logServerWarning(
  input: KlyxServerLogInput
): void {
  console.warn(
    JSON.stringify(
      createBaseRecord(
        "warn",
        input
      )
    )
  );
}

export function logServerError(
  input: KlyxServerErrorInput
): void {
  console.error(
    JSON.stringify({
      ...createBaseRecord(
        "error",
        input
      ),
      errorName:
        safeErrorName(
          input.error
        ),
      ...safeErrorMetadata(
        input.error
      ),
    })
  );
}
