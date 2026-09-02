import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  generateKlyxVisibleAiReply,
} from "@/lib/klyx-visible-ai";
import {
  GET as coreGet,
  PATCH as corePatch,
  POST as corePost,
} from "./assistant-route-core";

type Method = "GET" | "POST" | "PATCH";

type ProviderAssistantBody = {
  message?: unknown;
};

type ProviderAssistantResponse = {
  reply?: unknown;
  aiMode?: unknown;
  intent?: unknown;
  title?: unknown;
  payload?: unknown;
  draftId?: unknown;
  [key: string]: unknown;
};

async function secureBoundary(
  method: Method,
  handler: (request: Request) => Promise<Response>,
  request: Request
) {
  const startedAt = Date.now();

  try {
    const response = await handler(request);

    if (response.status < 500) {
      return response;
    }

    let error: unknown = new Error(
      `Provider assistant ${method} returned HTTP ${response.status}`
    );

    try {
      const payload = (await response.clone().json()) as {
        error?: unknown;
      };

      if (typeof payload.error === "string" && payload.error.trim()) {
        error = new Error(payload.error);
      }
    } catch {
      // Keep the synthetic error when the core response is not JSON.
    }

    return secureApiErrorResponse({
      error,
      event: `provider_assistant_${method.toLowerCase()}_failed`,
      route: "/api/provider/assistant",
      method,
      status: response.status,
      code: `KLYX_PROVIDER_ASSISTANT_${method}_FAILED`,
      startedAt,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: `provider_assistant_${method.toLowerCase()}_failed`,
      route: "/api/provider/assistant",
      method,
      status: 500,
      code: `KLYX_PROVIDER_ASSISTANT_${method}_FAILED`,
      startedAt,
    });
  }
}

async function visibleProviderPost(request: Request): Promise<Response> {
  const requestCopy = request.clone();
  const response = await corePost(request);

  if (!response.ok) {
    return response;
  }

  let requestBody: ProviderAssistantBody = {};
  let responseBody: ProviderAssistantResponse = {};

  try {
    requestBody = (await requestCopy.json()) as ProviderAssistantBody;
    responseBody =
      (await response.clone().json()) as ProviderAssistantResponse;
  } catch {
    return response;
  }

  const message =
    typeof requestBody.message === "string"
      ? requestBody.message.trim()
      : "";
  const deterministicReply =
    typeof responseBody.reply === "string"
      ? responseBody.reply.trim()
      : "";

  if (!message || !deterministicReply) {
    return response;
  }

  // The core already used OpenAI for genuinely unstructured conversation.
  // Do not bill a second model call for the same response.
  if (responseBody.aiMode === "openai") {
    return response;
  }

  const visibleReply = await generateKlyxVisibleAiReply({
    message,
    deterministicReply,
    accountType: "provider",
    lockedFacts: {
      intent: responseBody.intent ?? null,
      title: responseBody.title ?? null,
      draftId: responseBody.draftId ?? null,
      payload: responseBody.payload ?? null,
    },
  });

  return NextResponse.json(
    {
      ...responseBody,
      reply: visibleReply.text,
      aiMode: visibleReply.mode,
      deterministicSafety: true,
    },
    {
      status: response.status,
    }
  );
}

export async function GET(request: Request) {
  return secureBoundary("GET", coreGet, request);
}

export async function POST(request: Request) {
  return secureBoundary("POST", visibleProviderPost, request);
}

export async function PATCH(request: Request) {
  return secureBoundary("PATCH", corePatch, request);
}
