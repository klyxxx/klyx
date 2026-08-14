import type {
  KlyxBrainIntent,
} from "./contracts";

const VALID_INTENTS =
  new Set<KlyxBrainIntent>([
    "conversation",
    "service_request",
    "recommendation",
    "memory",
    "clarification",
    "unknown",
  ]);

export type OpenAiStructuredResult = {
  text: string;
  intent: KlyxBrainIntent;
  confidence: number;
};

function clampConfidence(
  value: number,
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      1,
      value,
    ),
  );
}

function normalizeIntent(
  value: unknown,
): KlyxBrainIntent {
  if (
    typeof value === "string" &&
    VALID_INTENTS.has(
      value as KlyxBrainIntent,
    )
  ) {
    return value as KlyxBrainIntent;
  }

  return "unknown";
}

export function parseOpenAiStructuredResult(
  raw: string,
): OpenAiStructuredResult {
  const parsed =
    JSON.parse(
      raw,
    ) as Record<string, unknown>;

  const text =
    typeof parsed.text === "string"
      ? parsed.text.trim()
      : "";

  if (!text) {
    throw new Error(
      "KLYX OpenAI response contains no text.",
    );
  }

  return {
    text,

    intent:
      normalizeIntent(
        parsed.intent,
      ),

    confidence:
      clampConfidence(
        typeof parsed.confidence === "number"
          ? parsed.confidence
          : 0,
      ),
  };
}