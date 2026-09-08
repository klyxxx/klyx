import { NextResponse } from "next/server";

import {
  KLYX_CONFIRMATION_BOUNDARY,
  getKlyxGuidedQuestion,
} from "@/lib/brain/guided-question";
import {
  withoutKlyxLlmShadow,
} from "@/lib/brain/llm/shadow";
import {
  parseBrainRespondRequest,
} from "@/lib/brain/respond-http-boundary";
import {
  isKlyxAssistantMessageTooLong,
} from "@/lib/klyx-assistant-message-limits";
import {
  generateKlyxVisibleAiReply,
} from "@/lib/klyx-visible-ai";
import {
  POST as deterministicPost,
} from "../respond/route";

type BrainPayload = {
  serviceSlug?: unknown;
  city?: unknown;
  date?: unknown;
  time?: unknown;
  budget?: unknown;
  missing?: unknown;
  ready?: unknown;
  memoryUsed?: unknown;
};

type BrainResponseBody = {
  reply?: unknown;
  payload?: BrainPayload;
  [key: string]: unknown;
};

function normalizedMissing(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0
  );
}

export async function POST(request: Request) {
  // The wrapper may inspect only a clone, and only through the certified
  // bounded parser from /respond. The original request remains untouched for
  // the authoritative deterministic route, which owns auth, durable quota,
  // final status and the same 32 KiB / 4,000-character boundary.
  const boundedInspectionRequest = request.clone();
  const parsedRequest =
    await parseBrainRespondRequest(boundedInspectionRequest);
  const message = parsedRequest.ok
    ? parsedRequest.value.message
    : "";

  // This shared-capacity check is fail-closed for Visible AI only. It never
  // returns an HTTP decision and therefore cannot replace or bypass /respond.
  // The certified parser above already enforces the authoritative 4,000-char
  // Brain boundary even if a UI capacity constant ever drifts.
  const suppressVisibleAiForCapacity =
    Boolean(message) &&
    isKlyxAssistantMessageTooLong(message);

  const response = await withoutKlyxLlmShadow(
    () => deterministicPost(request)
  );

  if (
    !response.ok ||
    !parsedRequest.ok ||
    suppressVisibleAiForCapacity
  ) {
    return response;
  }

  let responseBody: BrainResponseBody = {};

  try {
    responseBody = (await response.clone().json()) as BrainResponseBody;
  } catch {
    return response;
  }

  const deterministicReply =
    typeof responseBody.reply === "string"
      ? responseBody.reply.trim()
      : "";

  if (!deterministicReply) {
    return response;
  }

  const payload = responseBody.payload ?? {};
  const missing = normalizedMissing(payload.missing);
  const requiredTail =
    payload.ready === true
      ? KLYX_CONFIRMATION_BOUNDARY
      : getKlyxGuidedQuestion(missing[0]);
  const visibleReply = await generateKlyxVisibleAiReply({
    message,
    deterministicReply,
    accountType: "client",
    lockedFacts: {
      serviceSlug: payload.serviceSlug ?? null,
      city: payload.city ?? null,
      date: payload.date ?? null,
      time: payload.time ?? null,
      budget: payload.budget ?? null,
      missing,
      ready: payload.ready === true,
      memoryUsed: payload.memoryUsed === true,
    },
    requiredTail,
    suppressAiQuestions: Boolean(requiredTail),
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
