import { NextResponse } from "next/server";

import {
  generateKlyxVisibleAiReply,
} from "@/lib/klyx-visible-ai";
import {
  POST as deterministicPost,
} from "../respond/route";

type RequestBody = {
  message?: unknown;
};

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

export async function POST(request: Request) {
  const requestCopy = request.clone();
  const response = await deterministicPost(request);

  if (!response.ok) {
    return response;
  }

  let requestBody: RequestBody = {};
  let responseBody: BrainResponseBody = {};

  try {
    requestBody = (await requestCopy.json()) as RequestBody;
    responseBody = (await response.clone().json()) as BrainResponseBody;
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

  const payload = responseBody.payload ?? {};
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
      missing: payload.missing ?? [],
      ready: payload.ready === true,
      memoryUsed: payload.memoryUsed === true,
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
