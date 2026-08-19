import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import { POST as postSplitBookingCore } from "./book-route-core";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function sanitizeCoreResponse(
  response: Response,
  startedAt: number
): Promise<Response> {
  if (response.status >= 500) {
    return secureApiErrorResponse({
      error: new Error("split booking core returned an unexpected 5xx response"),
      event: "split_booking_create_failed",
      code: "KLYX_SPLIT_BOOKING_CREATE_FAILED",
      status: response.status,
      route: "/api/market/requests/[id]/split-fallback/book",
      method: "POST",
      startedAt,
      details: {
        bookingCreated: false,
        paymentCreated: false,
        automaticRetry: false,
      },
    });
  }

  if (response.status !== 409) {
    return response;
  }

  let body: unknown;

  try {
    body = await response.clone().json();
  }
  catch {
    return response;
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return response;
  }

  const record = body as Record<string, unknown>;

  if (record.code !== "SPLIT_BOOKING_CREATION_FAILED") {
    return response;
  }

  return NextResponse.json(
    {
      ...record,
      detail: "SPLIT_BOOKING_CREATION_FAILED",
    },
    {
      status: 409,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  const startedAt = Date.now();

  try {
    const response = await postSplitBookingCore(
      request,
      context
    );

    return sanitizeCoreResponse(
      response,
      startedAt
    );
  }
  catch (error) {
    return secureApiErrorResponse({
      error,
      event: "split_booking_create_failed",
      code: "KLYX_SPLIT_BOOKING_CREATE_FAILED",
      status: 500,
      route: "/api/market/requests/[id]/split-fallback/book",
      method: "POST",
      startedAt,
      details: {
        bookingCreated: false,
        paymentCreated: false,
        automaticRetry: false,
      },
    });
  }
}
