import { NextResponse } from "next/server";

import {
  generateKlyxVisibleAiReply,
} from "@/lib/klyx-visible-ai";
import {
  POST as deterministicPost,
} from "./assistant-route-core";

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

export async function POST(request: Request): Promise<Response> {
  const requestCopy = request.clone();
  const response = await deterministicPost(request);

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

  // Unknown/unstructured provider conversation already uses the shared LLM in
  // the deterministic core. Avoid paying for a second model call.
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
