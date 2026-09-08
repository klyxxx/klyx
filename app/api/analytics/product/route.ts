import { NextResponse } from "next/server";

import {
  adminErrorPublicMessage,
  adminErrorStatus,
  requireKlyxAdmin,
} from "@/lib/admin-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { isKlyxProductAnalyticsEvent } from "@/lib/klyx-product-analytics-events";
import { logServerError, logServerWarning } from "@/lib/server-log";

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

function resolvePostHogRuntime() {
  const rawProjectToken = process.env.POSTHOG_PROJECT_TOKEN?.trim();
  const rawHost = process.env.POSTHOG_HOST?.trim();
  const projectToken =
    rawProjectToken && rawProjectToken.length >= 10 ? rawProjectToken : null;
  const origin = resolvePostHogOrigin(rawHost);
  const tokenConfigured = Boolean(projectToken);
  const hostConfigured = Boolean(rawHost);
  const hostAllowed = Boolean(origin);

  return {
    projectToken,
    origin,
    diagnostic: {
      configured: tokenConfigured && hostAllowed,
      tokenConfigured,
      hostConfigured,
      hostAllowed,
    },
  };
}

async function validatePostHogRuntime(
  projectToken: string | null,
  origin: string | null
) {
  if (!projectToken || !origin) {
    return {
      tokenValid: null,
      validationState: "not_configured" as const,
      validationHttpStatus: null,
    };
  }

  try {
    const response = await fetch(`${origin}/flags?v=2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: projectToken,
        distinct_id: "klyx-posthog-config-diagnostic",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
    });

    if (response.ok) {
      return {
        tokenValid: true,
        validationState: "valid" as const,
        validationHttpStatus: response.status,
      };
    }

    if (response.status === 401) {
      return {
        tokenValid: false,
        validationState: "invalid_token" as const,
        validationHttpStatus: response.status,
      };
    }

    return {
      tokenValid: null,
      validationState: "upstream_error" as const,
      validationHttpStatus: response.status,
    };
  } catch (error) {
    logServerError({
      event: "posthog_product_validation_failed",
      route: "/api/analytics/product",
      method: "GET",
      code: "posthog_validation_unreachable",
      error,
    });

    return {
      tokenValid: null,
      validationState: "unreachable" as const,
      validationHttpStatus: null,
    };
  }
}

export async function GET() {
  const startedAt = Date.now();

  try {
    await requireKlyxAdmin();
    const runtime = resolvePostHogRuntime();
    const validation = await validatePostHogRuntime(
      runtime.projectToken,
      runtime.origin
    );

    return NextResponse.json(
      {
        ...runtime.diagnostic,
        ...validation,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const status = adminErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "product_analytics_diagnostic_failed",
      route: "/api/analytics/product",
      method: "GET",
      status,
      code: "KLYX_PRODUCT_ANALYTICS_DIAGNOSTIC_FAILED",
      publicMessage: adminErrorPublicMessage(status),
      startedAt,
    });
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

    const { projectToken, origin } = resolvePostHogRuntime();

    if (!projectToken || !origin) {
      return noContent();
    }

    const captureStartedAt = Date.now();

    try {
      const response = await fetch(`${origin}/i/v0/e/`, {
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

      if (!response.ok) {
        logServerWarning({
          event: "posthog_product_capture_rejected",
          route: "/api/analytics/product",
          method: "POST",
          status: response.status,
          code: "posthog_capture_rejected",
          durationMs: Date.now() - captureStartedAt,
        });
      }
    } catch (error) {
      logServerError({
        event: "posthog_product_capture_failed",
        route: "/api/analytics/product",
        method: "POST",
        code: "posthog_capture_failed",
        durationMs: Date.now() - captureStartedAt,
        error,
      });
    }

    return noContent();
  } catch {
    // Product analytics is deliberately fail-open for the KLYX user journey.
    return noContent();
  }
}
