// Server-only module: this helper reaches the service-role Supabase client and
// must only be imported by server routes/middleware. The boundary is enforced
// by the admin client/RPC privileges and integration contracts rather than the
// optional `server-only` package so Vitest can import middleware directly.
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

export type ApiRateLimitPolicy = {
  action: string;
  limit: number;
  windowSeconds: number;
};

export type ApiRateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  requestCount: number;
  windowStartedAt: string;
};

export const API_RATE_LIMIT_POLICIES = {
  aiRespond: {
    action: "ai_respond",
    limit: 12,
    windowSeconds: 60,
  },
  requestAnalysis: {
    action: "request_analysis",
    limit: 30,
    windowSeconds: 60,
  },
  brainRespond: {
    action: "brain_respond",
    limit: 20,
    windowSeconds: 60,
  },
  quoteCreate: {
    action: "quote_create",
    limit: 10,
    windowSeconds: 60,
  },
  quoteMutation: {
    action: "quote_mutation",
    limit: 20,
    windowSeconds: 60,
  },
  stripeCheckoutCreate: {
    action: "stripe_checkout_create",
    limit: 8,
    windowSeconds: 60,
  },
  stripeGroupCheckoutCreate: {
    action: "stripe_group_checkout_create",
    limit: 6,
    windowSeconds: 60,
  },
  stripeConnectOnboarding: {
    action: "stripe_connect_onboarding",
    limit: 6,
    windowSeconds: 300,
  },
  stripeConnectStatus: {
    action: "stripe_connect_status",
    limit: 30,
    windowSeconds: 60,
  },
} as const satisfies Record<string, ApiRateLimitPolicy>;

type RateLimitRpcRow = {
  allowed?: unknown;
  remaining?: unknown;
  retry_after_seconds?: unknown;
  request_count?: unknown;
  window_started_at?: unknown;
};

function subjectKeyHash(subjectId: string): string {
  return createHash("sha256")
    .update(`klyx-rate-limit:${subjectId}`, "utf8")
    .digest("hex");
}

function integer(value: unknown, label: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`KLYX rate limiter returned invalid ${label}.`);
  }

  return parsed;
}

export async function consumeApiRateLimit(
  subjectId: string,
  policy: ApiRateLimitPolicy
): Promise<ApiRateLimitResult> {
  if (!subjectId.trim()) {
    throw new Error("KLYX rate limiter requires an authenticated subject.");
  }

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_consume_api_rate_limit",
    {
      p_key_hash: subjectKeyHash(subjectId),
      p_action: policy.action,
      p_limit: policy.limit,
      p_window_seconds: policy.windowSeconds,
    }
  );

  if (error) {
    throw new Error(`KLYX rate limiter unavailable: ${error.message}`);
  }

  const row = Array.isArray(data)
    ? (data[0] as RateLimitRpcRow | undefined)
    : (data as RateLimitRpcRow | null);

  if (!row || typeof row.allowed !== "boolean") {
    throw new Error("KLYX rate limiter returned an invalid result.");
  }

  const windowStartedAt =
    typeof row.window_started_at === "string"
      ? row.window_started_at
      : "";

  if (!windowStartedAt) {
    throw new Error("KLYX rate limiter returned an invalid window timestamp.");
  }

  return {
    allowed: row.allowed,
    remaining: integer(row.remaining, "remaining quota"),
    retryAfterSeconds: integer(
      row.retry_after_seconds,
      "retry delay"
    ),
    requestCount: integer(row.request_count, "request count"),
    windowStartedAt,
  };
}

export function rateLimitResponseHeaders(
  policy: ApiRateLimitPolicy,
  result: ApiRateLimitResult
): Record<string, string> {
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(policy.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Policy": `${policy.limit};w=${policy.windowSeconds}`,
  };

  if (!result.allowed) {
    headers["Retry-After"] = String(
      Math.max(result.retryAfterSeconds, 1)
    );
  }

  return headers;
}

export function apiRateLimitExceededResponse(
  policy: ApiRateLimitPolicy,
  result: ApiRateLimitResult
): NextResponse {
  return NextResponse.json(
    {
      error: "Trop de requêtes. Réessaie dans quelques instants.",
      code: "KLYX_RATE_LIMITED",
      retryAfterSeconds: Math.max(result.retryAfterSeconds, 1),
    },
    {
      status: 429,
      headers: rateLimitResponseHeaders(policy, result),
    }
  );
}
