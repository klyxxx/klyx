import type {
  KlyxBrainIntent,
} from "../llm/contracts";

import type {
  KlyxPublicShadowStatus,
} from "./shadow-public";

export type InternalShadowLike = {
  attempted?: boolean;

  available?: boolean;

  provider?: string | null;

  model?: string | null;

  intent?: string | null;

  confidence?: number | null;

  agreementWithExpectedIntent?:
    boolean | null;

  agreementWithDeterministicBrain?:
    boolean | null;

  automaticExecutionAllowed?: false;

  text?: string | null;

  error?: string | null;
};

const VALID_INTENTS =
  new Set<KlyxBrainIntent>([
    "conversation",
    "service_request",
    "recommendation",
    "memory",
    "clarification",
    "unknown",
  ]);

function sanitizeIntent(
  value: string | null | undefined,
): KlyxBrainIntent | null {
  if (!value) {
    return null;
  }

  if (
    VALID_INTENTS.has(
      value as KlyxBrainIntent,
    )
  ) {
    return value as KlyxBrainIntent;
  }

  return "unknown";
}

function sanitizeConfidence(
  value: number | null | undefined,
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.min(
      1,
      value,
    ),
  );
}

export function sanitizeKlyxShadowForClient(
  value: InternalShadowLike | null | undefined,
  enabled = true,
): KlyxPublicShadowStatus {
  if (
    !enabled ||
    !value
  ) {
    return {
      enabled:
        false,

      attempted:
        false,

      available:
        false,

      provider:
        null,

      model:
        null,

      intent:
        null,

      confidence:
        null,

      agreementWithDeterministicBrain:
        null,

      automaticExecutionAllowed:
        false,

      internalTextExposed:
        false,
    };
  }

  const agreement =
    value.agreementWithDeterministicBrain ??
    value.agreementWithExpectedIntent ??
    null;

  return {
    enabled:
      true,

    attempted:
      value.attempted === true,

    available:
      value.available === true,

    provider:
      value.provider ??
      null,

    model:
      value.model ??
      null,

    intent:
      sanitizeIntent(
        value.intent,
      ),

    confidence:
      sanitizeConfidence(
        value.confidence,
      ),

    agreementWithDeterministicBrain:
      agreement,

    automaticExecutionAllowed:
      false,

    internalTextExposed:
      false,
  };
}