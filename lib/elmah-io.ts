const ELMAH_IO_API_ORIGIN = "https://api.elmah.io";
export const KLYX_ELMAH_IO_LOG_ID =
  "bac0ae51-d911-4ab5-8263-60a1e96b58ec";

const KLYX_ELMAH_IO_APPLICATION = "klyx.be";
const ELMAH_IO_TIMEOUT_MS = 2_500;
const MAX_IDENTIFIER_LENGTH = 96;
const MAX_ROUTE_LENGTH = 240;

type ElmahDataItem = {
  key: string;
  value: string;
};

type ElmahMessage = {
  title: string;
  severity: "Error";
  application: string;
  version?: string;
  type?: string;
  source: string;
  url?: string;
  method?: string;
  statusCode?: number;
  correlationId?: string;
  detail?: string;
  data?: ElmahDataItem[];
};

type KlyxApiErrorReport = {
  event: string;
  route: string;
  method: string;
  status: number;
  code: string;
  durationMs?: number;
  requestId?: string;
  error?: unknown;
};

type KlyxUnhandledRequestErrorReport = {
  error: unknown;
  method?: string;
  routePath?: string;
  routerKind?: string;
  routeType?: string;
  renderSource?: string;
};

function productionApiKey(): string | null {
  if (process.env.VERCEL_ENV !== "production") {
    return null;
  }

  const apiKey = process.env.ELMAH_IO_API_KEY?.trim();
  return apiKey || null;
}

function deploymentVersion(): string | undefined {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();

  if (!sha || !/^[0-9a-f]{7,40}$/i.test(sha)) {
    return undefined;
  }

  return sha.slice(0, 12).toLowerCase();
}

function safeIdentifier(
  value: string | undefined,
  fallback: string
): string {
  const normalized = value
    ?.trim()
    .replace(/[^A-Za-z0-9_.:/-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_IDENTIFIER_LENGTH);

  return normalized || fallback;
}

function safeRoute(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const pathOnly = value.split(/[?#]/, 1)[0]?.trim();
  if (!pathOnly) {
    return undefined;
  }

  const normalized = (pathOnly.startsWith("/")
    ? pathOnly
    : `/${pathOnly}`)
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
      ":id"
    )
    .replace(/\/[A-Za-z0-9_-]{20,}(?=\/|$)/g, "/:id")
    .slice(0, MAX_ROUTE_LENGTH);

  return normalized || undefined;
}

function safeErrorName(error: unknown): string {
  if (error instanceof Error) {
    return safeIdentifier(error.name, "Error");
  }

  return "UnknownError";
}

function safeDigest(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== "string") {
    return undefined;
  }

  const normalized = digest.trim();
  if (!/^[A-Za-z0-9_.:-]{1,96}$/.test(normalized)) {
    return undefined;
  }

  return normalized;
}

function item(
  key: string,
  value: string | number | boolean | undefined
): ElmahDataItem | null {
  if (value === undefined) {
    return null;
  }

  return {
    key,
    value: String(value).slice(0, 160),
  };
}

function compactData(
  entries: Array<ElmahDataItem | null>
): ElmahDataItem[] {
  return entries.filter(
    (entry): entry is ElmahDataItem => entry !== null
  );
}

async function postElmahJson(
  path: string,
  body: unknown,
  contentType = "application/json"
): Promise<boolean> {
  const apiKey = productionApiKey();
  if (!apiKey) {
    return false;
  }

  try {
    const response = await fetch(`${ELMAH_IO_API_ORIGIN}${path}`, {
      method: "POST",
      headers: {
        api_key: apiKey,
        "Content-Type": contentType,
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(ELMAH_IO_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(
        JSON.stringify({
          marker: "KLYX_ELMAH_IO_DELIVERY_FAILED",
          status: response.status,
          operation: safeIdentifier(path, "unknown_operation"),
        })
      );
    }

    return response.ok;
  } catch (error) {
    console.warn(
      JSON.stringify({
        marker: "KLYX_ELMAH_IO_DELIVERY_FAILED",
        status: 0,
        operation: safeIdentifier(path, "unknown_operation"),
        errorName: safeErrorName(error),
      })
    );
    return false;
  }
}

async function createMessage(message: ElmahMessage): Promise<boolean> {
  return postElmahJson(
    `/v3/messages/${KLYX_ELMAH_IO_LOG_ID}`,
    message
  );
}

export function isKlyxElmahIoConfigured(): boolean {
  return productionApiKey() !== null;
}

export function isKlyxElmahHeartbeatConfigured(): boolean {
  if (!isKlyxElmahIoConfigured()) {
    return false;
  }

  const heartbeatId = process.env.ELMAH_IO_HEARTBEAT_ID?.trim();
  if (!heartbeatId) {
    return false;
  }

  return (
    /^[0-9a-f]{32}$/i.test(heartbeatId) ||
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(heartbeatId)
  );
}

export async function reportKlyxApiError(
  input: KlyxApiErrorReport
): Promise<boolean> {
  if (input.status < 500 || input.status > 599) {
    return false;
  }

  const event = safeIdentifier(input.event, "api_error");
  const code = safeIdentifier(input.code, "internal_error");
  const route = safeRoute(input.route);
  const method = safeIdentifier(
    input.method?.toUpperCase(),
    "UNKNOWN"
  );
  const errorName = safeErrorName(input.error);
  const correlationId = input.requestId
    ? safeIdentifier(input.requestId, "") || undefined
    : undefined;

  return createMessage({
    title: `${event} [${code}]`,
    severity: "Error",
    application: KLYX_ELMAH_IO_APPLICATION,
    version: deploymentVersion(),
    type: errorName,
    source: "KLYX Next.js API",
    url: route,
    method,
    statusCode: input.status,
    correlationId,
    detail: [
      `event=${event}`,
      `code=${code}`,
      route ? `route=${route}` : null,
      `status=${input.status}`,
    ]
      .filter((value): value is string => Boolean(value))
      .join("\n"),
    data: compactData([
      item("event", event),
      item("code", code),
      item("durationMs", input.durationMs),
    ]),
  });
}

export async function reportKlyxUnhandledRequestError(
  input: KlyxUnhandledRequestErrorReport
): Promise<boolean> {
  const route = safeRoute(input.routePath);
  const method = safeIdentifier(
    input.method?.toUpperCase(),
    "UNKNOWN"
  );
  const errorName = safeErrorName(input.error);

  return createMessage({
    title: "next_unhandled_request_error",
    severity: "Error",
    application: KLYX_ELMAH_IO_APPLICATION,
    version: deploymentVersion(),
    type: errorName,
    source: "KLYX Next.js instrumentation",
    url: route,
    method,
    statusCode: 500,
    detail: [
      "event=next_unhandled_request_error",
      route ? `route=${route}` : null,
      `type=${errorName}`,
    ]
      .filter((value): value is string => Boolean(value))
      .join("\n"),
    data: compactData([
      item("routerKind", input.routerKind),
      item("routeType", input.routeType),
      item("renderSource", input.renderSource),
      item("digest", safeDigest(input.error)),
    ]),
  });
}

export async function sendKlyxElmahHeartbeat(): Promise<boolean> {
  if (!isKlyxElmahHeartbeatConfigured()) {
    return false;
  }

  const heartbeatId = process.env.ELMAH_IO_HEARTBEAT_ID!.trim();

  return postElmahJson(
    `/v3/heartbeats/${KLYX_ELMAH_IO_LOG_ID}/${heartbeatId}`,
    {
      result: "Healthy",
      application: KLYX_ELMAH_IO_APPLICATION,
      version: deploymentVersion(),
    },
    "application/json-patch+json"
  );
}
