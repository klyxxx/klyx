import { isKlyxProductAnalyticsEvent } from "@/lib/klyx-product-analytics-events";

const MAX_BODY_BYTES = 2048;
const CAPTURE_TIMEOUT_MS = 2000;

const POSTHOG_INGESTION_ORIGINS = new Set([
  "https://eu.i.posthog.com",
  "https://us.i.posthog.com",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function noContent() {
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function resolvePostHogOrigin(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);

    if (
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !POSTHOG_INGESTION_ORIGINS.has(url.origin)
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return noContent();
    }

    const rawBody = await request.text();
    if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return noContent();
    }

    const payload = JSON.parse(rawBody) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return noContent();
    }

    const keys = Object.keys(payload);
    if (
      keys.length !== 2 ||
      !keys.includes("event") ||
      !keys.includes("sessionId")
    ) {
      return noContent();
    }

    const event = (payload as { event?: unknown }).event;
    const sessionId = (payload as { sessionId?: unknown }).sessionId;

    if (
      !isKlyxProductAnalyticsEvent(event) ||
      typeof sessionId !== "string" ||
      !UUID_PATTERN.test(sessionId)
    ) {
      return noContent();
    }

    const projectToken = process.env.POSTHOG_PROJECT_TOKEN?.trim();
    const origin = resolvePostHogOrigin(process.env.POSTHOG_HOST);

    if (!projectToken || projectToken.length < 10 || !origin) {
      return noContent();
    }

    await fetch(`${origin}/i/v0/e/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: projectToken,
        event,
        distinct_id: `klyx-session:${sessionId}`,
        properties: {
          $process_person_profile: false,
          $geoip_disable: true,
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
    });

    return noContent();
  } catch {
    // Product analytics is deliberately fail-open for the KLYX user journey.
    return noContent();
  }
}
