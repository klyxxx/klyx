import { NextResponse } from "next/server";

import {
  generateKlyxVisibleAiReply,
} from "@/lib/klyx-visible-ai";
import {
  POST as deterministicPost,
} from "./assistant-route-core";
import {
  parseProviderAssistantPostRequest,
} from "./provider-assistant-http-boundary";

type ProviderAssistantResponse = {
  reply?: unknown;
  aiMode?: unknown;
  intent?: unknown;
  title?: unknown;
  payload?: unknown;
  draftId?: unknown;
  [key: string]: unknown;
};

export async function POST(request: Request): Promise<Response> {
  const requestCopy = request.clone();
  const response = await deterministicPost(request);

  if (!response.ok) {
    return response;
  }

  // The core has already authenticated, consumed the durable AI quota and
  // accepted the authoritative bounded payload. Re-read only the bounded clone
  // for cosmetic wording; never parse that clone directly as unbounded JSON.
  const parsedRequest =
    await parseProviderAssistantPostRequest(requestCopy);

  if (!parsedRequest.ok) {
    return response;
  }

  let responseBody: ProviderAssistantResponse = {};

  try {
    responseBody =
      (await response.clone().json()) as ProviderAssistantResponse;
  } catch {
    return response;
  }

  const message = parsedRequest.value.message;
  const deterministicReply =
    typeof responseBody.reply === "string"
      ? responseBody.reply.trim()
      : "";

  if (!deterministicReply) {
    return response;
  }

  // Unknown conversation is finalized in the core after its single shared-LLM
  // attempt. Live orchestration is also final here: missions, amounts, scores,
  // compatibility and confirmation boundaries must never be rewritten by a model.
  if (
    responseBody.intent === "unknown" ||
    responseBody.intent === "mission_plan"
  ) {
    return response;
  }

  const visibleReply = await generateKlyxVisibleAiReply({
    message,
    deterministicReply,
    accountType: "provider",
    lockedFacts: {
      intent: responseBody.intent ?? null,
      title: responseBody.title ?? null,
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
      headers: response.headers,
    }
  );
}
