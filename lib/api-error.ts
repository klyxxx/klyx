import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { logServerError } from "@/lib/server-log";

export const INTERNAL_API_ERROR_MESSAGE =
  "Une erreur interne est survenue. Réessaie plus tard.";

const CLIENT_API_ERROR_MESSAGE =
  "La requête ne peut pas être traitée.";

type SecureApiErrorResponseInput = {
  error: unknown;
  event: string;
  route: string;
  method: string;
  code: string;
  status?: number;
  publicMessage?: string;
  startedAt?: number;
  details?: Record<
    string,
    | string
    | number
    | boolean
    | null
  >;
};

function normalizeStatus(
  status: number | undefined
): number {
  if (
    typeof status !== "number" ||
    !Number.isInteger(status) ||
    status < 400 ||
    status > 599
  ) {
    return 500;
  }

  return status;
}

function normalizeCode(
  code: string
): string {
  const normalized = code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);

  return normalized || "internal_error";
}

function normalizePublicMessage(
  message: string | undefined
): string | undefined {
  const normalized = message
    ?.replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);

  return normalized || undefined;
}

function publicErrorMessage(
  status: number,
  publicMessage: string | undefined
): string {
  if (status >= 500) {
    return INTERNAL_API_ERROR_MESSAGE;
  }

  return (
    normalizePublicMessage(publicMessage) ??
    CLIENT_API_ERROR_MESSAGE
  );
}

function normalizeDetails(
  details:
    | SecureApiErrorResponseInput["details"]
    | undefined
): Record<
  string,
  string | number | boolean | null
> {
  if (!details) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(details)
      .filter(([key, value]) =>
        /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(
          key
        ) &&
        (value === null ||
          typeof value === "string" ||
          typeof value === "boolean" ||
          (typeof value === "number" &&
            Number.isFinite(value)))
      )
      .map(([key, value]) => [
        key,
        typeof value === "string"
          ? value
              .replace(
                /[\r\n\t]/g,
                " "
              )
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 120)
          : value,
      ])
  );
}

export function secureApiErrorResponse(
  input: SecureApiErrorResponseInput
): NextResponse {
  const status = normalizeStatus(
    input.status
  );
  const code = normalizeCode(
    input.code
  );
  const requestId = randomUUID();
  const durationMs =
    typeof input.startedAt === "number"
      ? Math.max(
          0,
          Date.now() -
            input.startedAt
        )
      : undefined;

  logServerError({
    event: input.event,
    route: input.route,
    method: input.method,
    status,
    code,
    durationMs,
    requestId,
    error: input.error,
  });

  return NextResponse.json(
    {
      ...normalizeDetails(
        input.details
      ),
      error: publicErrorMessage(
        status,
        input.publicMessage
      ),
      code,
      requestId,
    },
    {
      status,
      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}
