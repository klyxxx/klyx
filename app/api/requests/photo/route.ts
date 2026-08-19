import { secureApiErrorResponse } from "@/lib/api-error";
import {
  DELETE as deletePhotoRequestCore,
  POST as createPhotoRequestCore,
} from "./photo-route-core";

async function securePhotoResponse(params: {
  request: Request;
  method: "POST" | "DELETE";
}) {
  const startedAt = Date.now();
  const handler =
    params.method === "POST"
      ? createPhotoRequestCore
      : deletePhotoRequestCore;

  try {
    const response = await handler(params.request);

    if (response.status < 500) {
      return response;
    }

    return secureApiErrorResponse({
      error: new Error(`Photo request ${params.method} failed.`),
      event:
        params.method === "POST"
          ? "photo_request_analysis_failed"
          : "photo_request_delete_failed",
      route: "/api/requests/photo",
      method: params.method,
      code:
        params.method === "POST"
          ? "KLYX_PHOTO_REQUEST_ANALYSIS_FAILED"
          : "KLYX_PHOTO_REQUEST_DELETE_FAILED",
      status: response.status,
      startedAt,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event:
        params.method === "POST"
          ? "photo_request_analysis_failed"
          : "photo_request_delete_failed",
      route: "/api/requests/photo",
      method: params.method,
      code:
        params.method === "POST"
          ? "KLYX_PHOTO_REQUEST_ANALYSIS_FAILED"
          : "KLYX_PHOTO_REQUEST_DELETE_FAILED",
      status: 500,
      startedAt,
    });
  }
}

export async function POST(request: Request) {
  return securePhotoResponse({ request, method: "POST" });
}

export async function DELETE(request: Request) {
  return securePhotoResponse({ request, method: "DELETE" });
}
