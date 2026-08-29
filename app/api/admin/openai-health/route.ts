import { NextResponse } from "next/server";

import {
  adminErrorPublicMessage,
  adminErrorStatus,
  requireKlyxAdmin,
} from "@/lib/admin-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  logServerError,
  logServerWarning,
} from "@/lib/server-log";

type OpenAiErrorPayload = {
  error?: {
    code?: unknown;
    type?: unknown;
  };
};

type OpenAiSuccessPayload = {
  output_text?: unknown;
  output?: unknown;
  status?: unknown;
  incomplete_details?: {
    reason?: unknown;
  };
};

function safeString(
  value: unknown,
  maxLength = 300
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized =
    value.trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(
    0,
    maxLength
  );
}

function extractOutputText(
  payload: OpenAiSuccessPayload
): string {
  if (
    typeof payload.output_text ===
      "string" &&
    payload.output_text.trim()
  ) {
    return payload.output_text.trim();
  }

  const output =
    Array.isArray(payload.output)
      ? payload.output
      : [];

  for (const item of output) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      continue;
    }

    const record =
      item as Record<
        string,
        unknown
      >;

    const content =
      Array.isArray(
        record.content
      )
        ? record.content
        : [];

    for (const part of content) {
      if (
        !part ||
        typeof part !== "object"
      ) {
        continue;
      }

      const text =
        (
          part as Record<
            string,
            unknown
          >
        ).text;

      if (
        typeof text === "string" &&
        text.trim()
      ) {
        return text.trim();
      }
    }
  }

  return "";
}

export async function GET() {
  const startedAt = Date.now();

  try {
    await requireKlyxAdmin();

    const apiKey =
      process.env
        .OPENAI_API_KEY
        ?.trim() ?? "";

    const model =
      process.env
        .KLYX_OPENAI_MODEL
        ?.trim() ||
      "gpt-5-mini";

    if (!apiKey) {
      return NextResponse.json(
        {
          ready: false,
          configured: false,
          model,
          apiStatus: null,
          errorType:
            "configuration_error",
          errorCode:
            "OPENAI_API_KEY_MISSING",
          errorMessage:
            "OPENAI_API_KEY absente.",
        },
        {
          status: 200,
        }
      );
    }

    let response: Response;

    try {
      response =
        await fetch(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${apiKey}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              model,
              input:
                "Réponds uniquement avec le mot OK.",
              max_output_tokens:
                256,
            }),
            signal:
              AbortSignal.timeout(
                20000
              ),
            cache: "no-store",
          }
        );
    } catch (error) {
      logServerError({
        error,
        event: "admin_openai_health_network_failed",
        route: "/api/admin/openai-health",
        method: "GET",
        status: 502,
        code: "KLYX_ADMIN_OPENAI_HEALTH_NETWORK_FAILED",
        durationMs: Math.max(0, Date.now() - startedAt),
      });

      return NextResponse.json(
        {
          ready: false,
          configured: true,
          model,
          apiStatus: null,
          errorType:
            error instanceof Error
              ? error.name
              : "network_error",
          errorCode:
            "OPENAI_REQUEST_FAILED",
          errorMessage:
            "OpenAI n'est pas joignable depuis KLYX.",
        },
        {
          status: 200,
        }
      );
    }

    let payload:
      | OpenAiErrorPayload
      | OpenAiSuccessPayload =
      {};

    try {
      payload =
        await response.json() as
          | OpenAiErrorPayload
          | OpenAiSuccessPayload;
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const errorPayload =
        payload as OpenAiErrorPayload;

      logServerWarning({
        event: "admin_openai_health_upstream_rejected",
        route: "/api/admin/openai-health",
        method: "GET",
        status: response.status,
        code: "KLYX_ADMIN_OPENAI_HEALTH_UPSTREAM_REJECTED",
        durationMs: Math.max(0, Date.now() - startedAt),
      });

      return NextResponse.json(
        {
          ready: false,
          configured: true,
          model,
          apiStatus:
            response.status,
          errorType:
            safeString(
              errorPayload.error
                ?.type
            ),
          errorCode:
            safeString(
              errorPayload.error
                ?.code
            ),
          errorMessage:
            "OpenAI a refusé la requête de diagnostic.",
        },
        {
          status: 200,
        }
      );
    }

    const successPayload =
      payload as OpenAiSuccessPayload;
    const output =
      extractOutputText(
        successPayload
      );
    const responseStatus =
      safeString(
        successPayload.status
      );
    const incompleteReason =
      safeString(
        successPayload
          .incomplete_details
          ?.reason
      );

    return NextResponse.json(
      {
        ready:
          Boolean(output),
        configured: true,
        model,
        apiStatus:
          response.status,
        responseStatus,
        incompleteReason,
        outputReceived:
          Boolean(output),
        outputPreview:
          output
            ? output.slice(
                0,
                80
              )
            : null,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    const status = adminErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "admin_openai_health_failed",
      route: "/api/admin/openai-health",
      method: "GET",
      status,
      code: "KLYX_ADMIN_OPENAI_HEALTH_FAILED",
      publicMessage: adminErrorPublicMessage(status),
      startedAt,
      details: {
        ready: false,
      },
    });
  }
}
