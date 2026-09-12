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

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function missionPlanReply(payload: unknown, intro: string): string {
  const body = asRecord(payload);
  const combinations = Array.isArray(body?.combinations)
    ? body.combinations
        .map(asRecord)
        .filter((item): item is JsonRecord => item !== null)
        .slice(0, 3)
    : [];

  if (combinations.length === 0) return intro;

  const currency = asText(body?.currency) || "EUR";
  const lines: string[] = [intro, ""];

  combinations.forEach((combination, index) => {
    const potentialAmount = asNumber(combination.potentialAmount);
    const explanation = asText(combination.explanation);
    const missions = Array.isArray(combination.missions)
      ? combination.missions
          .map(asRecord)
          .filter((item): item is JsonRecord => item !== null)
          .slice(0, 3)
      : [];

    lines.push(
      `Option ${index + 1}${
        potentialAmount === null
          ? ""
          : ` · potentiel indicatif ${potentialAmount.toLocaleString("fr-BE", {
              maximumFractionDigits: 2,
            })} ${currency}`
      }`
    );

    for (const mission of missions) {
      const service = asText(mission.serviceLabel) || "Service KLYX";
      const title = asText(mission.title);
      const city = asText(mission.city);
      const date = asText(mission.date);
      const startTime = asText(mission.startTime);
      const endTime = asText(mission.endTime);
      const amountLabel = asText(mission.amountLabel);
      const schedule = [
        date,
        startTime && endTime
          ? `${startTime}–${endTime}`
          : startTime
            ? `à partir de ${startTime}`
            : "",
      ]
        .filter(Boolean)
        .join(" · ");

      lines.push(
        `• ${service}${title ? ` — ${title}` : ""}${city ? ` · ${city}` : ""}`
      );
      if (schedule) lines.push(`  ${schedule}`);
      if (amountLabel) lines.push(`  ${amountLabel}`);
    }

    if (explanation) lines.push(`Pourquoi : ${explanation}`);
    if (index < combinations.length - 1) lines.push("");
  });

  return lines.join("\n");
}

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
  // attempt. Live mission plans are also finalized deterministically because
  // their exact jobs, amounts and safety facts come from KLYX data and must
  // never be rewritten by a model.
  if (responseBody.intent === "unknown") {
    return response;
  }

  if (responseBody.intent === "mission_plan") {
    return NextResponse.json(
      {
        ...responseBody,
        reply: missionPlanReply(responseBody.payload, deterministicReply),
        aiMode: "fallback",
        deterministicSafety: true,
      },
      {
        status: response.status,
        headers: response.headers,
      }
    );
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
