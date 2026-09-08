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
  // Keep a second stream only for the optional Visible AI wording pass.
  // The authoritative /respond route consumes and validates the original body
  // first, including auth, durable rate limiting and the certified 32 KiB / 4k
  // HTTP boundary. Cloning itself does not parse or materialize the body.
  const visibleAiRequest = request.clone();

  const response = await withoutKlyxLlmShadow(
    () => deterministicPost(request)
  );

  if (!response.ok) {
    return response;
  }

  // Reuse the exact certified parser from /respond rather than maintaining a
  // second message/body limit in this wrapper. This happens only after the
  // deterministic route has already consumed the durable Brain quota.
  const parsedRequest =
    await parseBrainRespondRequest(visibleAiRequest);

  if (!parsedRequest.ok) {
    // A successful deterministic response and a failed parse of the identical
    // cloned body should be unreachable. Fail closed to deterministic output
    // and never invoke the provider if the two views ever disagree.
    return response;
  }

  const message = parsedRequest.value.message;

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
