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
    })
  );
}