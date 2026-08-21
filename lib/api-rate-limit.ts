import "server-only";

import { createHash } from "node:crypto";

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
} as const satisfies Record<string, ApiRateLimitPolicy>;

type RateLimitRpcRow = {
  allowed?: unknown;
  remaining?: unknown;
  retry_after_seconds?: unknown;
  request_count?: unknown;
  window_started_at?: unknown;
};

function profileKeyHash(profileId: string): string {
  return createHash("sha256")
    .update(`profile:${profileId}`, "utf8")
    .digest("hex");
}

function integer(value: unknown, label: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`KLYX rate limiter returned invalid ${label}.`);
  }

  return parsed;
}

export async function consumeProfileRateLimit(
  profileId: string,
  policy: ApiRateLimitPolicy
): Promise<ApiRateLimitResult> {
  if (!profileId.trim()) {
    throw new Error("KLYX rate limiter requires an authenticated profile.");
  }

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_consume_api_rate_limit",
    {
      p_key_hash: profileKeyHash(profileId),
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
